# KIẾN TRÚC VÀ THIẾT KẾ HỆ THỐNG NCS FUSION CENTER (SYSTEM DESIGN)
## TÀI LIỆU DÀNH CHO GIAI ĐOẠN GO-LIVE & ĐỊNH HƯỚNG NÂNG CẤP KUBERNETES (K8S)

Tài liệu này cung cấp cái nhìn toàn cảnh về kiến trúc hệ thống, luồng dữ liệu nghiệp vụ, cơ chế quản lý dữ liệu an toàn bằng Docker External Volumes, hướng dẫn chi tiết cách thức mở rộng Database khi có tính năng mới, và **đặc biệt là Kịch bản nâng cấp toàn diện lên hạ tầng Kubernetes (K8s) chuẩn Cloud-Native**.

---

## 1. Tổng Quan Kiến Trúc Hệ Thống Hiện Tại

NCS Fusion Center là nền tảng điều hành an ninh SOC thế hệ mới. Hệ thống được viết lại toàn diện dựa trên kiến trúc Microservices phân lớp, thay thế hoàn toàn công nghệ Scala/sbt cũ của TheHive4 bằng Golang và Next.js nhằm tối ưu hóa hiệu năng, giảm thiểu tài nguyên tiêu hao và nâng cao trải nghiệm người dùng cục bộ.

Hệ thống được chia làm hai Stack chính chạy song song trên môi trường Docker:
1.  **NCS Fusion Center Stack (Core)**: Nền tảng điều hành SOC, quản lý case, phân tích bằng chứng sự cố và tìm kiếm tập trung.
2.  **MISP Standalone Stack (Threat Intelligence)**: Cung cấp kho dữ liệu chỉ thị tấn công (IOC), đồng bộ trực tiếp hai chiều với Go Core Backend.

```mermaid
graph TD
    %% User Layer
    User([Điều tra viên / Admin SOC]) -->|Port 3000| FE[Next.js Frontend]
    
    %% Application Layer
    FE -->|Port 8080 API| BE[Go Core Backend]
    
    %% Middleware & Storage Layer
    BE -->|PostgreSQL DSN| DB[(PostgreSQL 16)]
    BE -->|AMQP Protocol| MQ[RabbitMQ Message Queue]
    BE -->|S3 API| ObjectStorage[(MinIO Object Storage)]
    BE -->|Elastic Query| SearchEngine[(OpenSearch Index)]
    
    %% Integrations
    BE -->|Sync API Port 80| MISP[MISP Web Server]
    MISP -->|Local Port 3306| MISP_DB[(MISP MariaDB)]
    
    %% Storage Volumes
    subgraph External Volumes (Docker Engine Host)
        postgres-data[(postgres-data)] -.-> DB
        minio-data[(minio-data)] -.-> ObjectStorage
        rabbitmq-data[(rabbitmq-data)] -.-> MQ
        opensearch-data[(opensearch-data)] -.-> SearchEngine
        misp-db-data[(misp-db-data)] -.-> MISP_DB
        misp-web-data[(misp-web-data)] -.-> MISP
    end
    
    classDef primary fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef secondary fill:#0f172a,stroke:#64748b,stroke-width:2px,color:#fff;
    classDef storage fill:#1c1917,stroke:#78716c,stroke-width:2px,color:#fff;
    
    class FE,BE primary;
    class DB,MQ,ObjectStorage,SearchEngine,MISP,MISP_DB secondary;
    class postgres-data,minio-data,rabbitmq-data,opensearch-data,misp-db-data,misp-web-data storage;
```

---

## 2. Bản Đồ Công Nghệ & Vai Trò Các Thành Phần

### 2.1. Next.js Frontend (`frontend`)
*   **Công nghệ**: Next.js 14+, React, TailwindCSS, TypeScript.
*   **Vai trò**: Cung cấp giao diện Web SPA tối ưu hóa trải nghiệm người dùng bằng Tiếng Việt. Tích hợp API Proxy thông qua Next.js Server Actions hoặc API routes trỏ thẳng tới Core Backend để tránh lỗi CORS.
*   **Quy trình xác thực cục bộ (Local Authentication Flow)**: Khi không bật SMTP (`MAIL_ENABLED=false`), Next.js UI tự động nhận diện `reset_token` hoặc `invite_token` từ response của API quản trị, từ đó kết xuất trực tiếp liên kết reset mật khẩu dạng nổi bật trên giao diện Admin. Admin chỉ cần copy link cục bộ này và bàn giao trực tiếp cho người dùng cuối.

### 2.2. Go Core Backend (`backend`)
*   **Công nghệ**: Golang, Gin Web Framework, GORM v2, Go-Redis (nếu cần), các thư viện AMQP & S3 Client.
*   **Vai trò**: 
    *   Cung cấp API RESTful bảo mật bằng JWT Token.
    *   Xử lý logic cốt lõi về Case Management, Tasks, Metrics và Audit Logs.
    *   Điều phối và đẩy các tác vụ nặng (như phân tích file bằng chứng, đồng bộ sự kiện MISP) vào hàng đợi RabbitMQ.
    *   Tự động chạy database migration khi khởi động để đảm bảo tính nhất quán của schema.

### 2.3. Tầng Lưu Trữ & Middleware (Dữ liệu SOC)
*   **PostgreSQL 16**: Lưu trữ dữ liệu quan hệ có cấu trúc và tính nhất quán cao. Phù hợp hoàn hảo để quản lý người dùng, phân quyền (RBAC), thông tin case và log hoạt động.
*   **RabbitMQ**: Cầu nối tin nhắn bất đồng bộ, giúp backend hoạt động phi tuyến tính, xử lý tác vụ quét mã độc file đính kèm song song mà không gây nghẽn luồng API chính.
*   **MinIO**: Hệ thống lưu trữ đối tượng dạng phân tán (Object Storage), tương thích S3 API. Đây là nơi lưu trữ an toàn toàn bộ file đính kèm, bằng chứng kỹ thuật số của các case điều tra.
*   **OpenSearch**: Bộ công cụ tìm kiếm và phân tích phân tán. Toàn bộ thông tin vụ việc, logs, và IOC được đồng bộ sang OpenSearch để phục vụ tính năng tìm kiếm văn bản toàn diện (Full-text Search) siêu tốc trên hàng triệu bản ghi.

---

## 3. Quản Lý Dữ Liệu An Toàn Bằng Docker External Volumes

Khi triển khai trên một máy chủ đơn lẻ (Single Host), Docker External Volumes là giải pháp lưu trữ tối ưu nhất.

### 3.1. Thiết kế kỹ thuật
Trong tệp cấu hình `docker-compose.yml`, các volume không được định nghĩa cục bộ theo tiền tố dự án mà được khai báo `external: true`:
```yaml
volumes:
  postgres-data:
    external: true
  rabbitmq-data:
    external: true
  minio-data:
    external: true
  opensearch-data:
    external: true
```

### 3.2. Cơ chế sao lưu (Snapshot Backup)
Do toàn bộ dữ liệu trạng thái (Stateful Data) được ghi vào các volume ngoài này trên Host OS (đường dẫn mặc định `/var/lib/docker/volumes/`), chúng ta có thể thực hiện sao lưu ở tầng hạ tầng cực kỳ nhanh chóng và an toàn theo quy trình sau:
1.  **Freeze/Dừng container**: Tạm thời dừng việc ghi đè DB bằng cách hạ dịch vụ: `docker compose down`.
2.  **Snapshot ổ đĩa**: Kích hoạt chụp Snapshot phân vùng dữ liệu của máy chủ ở tầng ảo hóa (AWS EBS Snapshot, Proxmox Snapshot).
3.  **Khởi động lại dịch vụ**: Chạy lệnh `docker compose up -d` để tiếp tục vận hành. Toàn bộ quy trình chỉ diễn ra trong vòng chưa đầy 1 phút và đảm bảo tính nhất quán dữ liệu (Data Consistency) đạt 100%.

---

## 4. Hướng Dẫn Mở Rộng Cơ Sở Dữ Liệu Khi Thêm Tính Năng Mới

Khi hệ thống SOC phát triển thêm các tính năng mới cần cơ sở dữ liệu riêng, chúng ta áp dụng 2 phương án thiết kế kiến trúc chuẩn như sau:

### Phương án A: Mô hình Database Độc lập (Microservices - Khuyên dùng)
*Áp dụng khi tính năng mới là một dịch vụ lớn, có vòng đời phát triển độc lập, cần sử dụng các loại DB chuyên biệt (như Redis làm cache, MongoDB cho log thô).*

#### Cấu hình Docker Compose mẫu cho dịch vụ mới (`playbook-service`):
```yaml
services:
  # Container DB độc lập cho dịch vụ Playbook
  playbook-postgres:
    image: postgres:16-alpine
    container_name: ncs-playbook-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: playbook_db
      POSTGRES_USER: playbook_user
      POSTGRES_PASSWORD: playbook_secure_password
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - playbook-postgres-data:/var/lib/postgresql/data
    networks:
      - thehive-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U playbook_user -d playbook_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Dịch vụ Playbook
  playbook-service:
    image: thehive-platform-playbook:latest
    container_name: ncs-playbook-service
    restart: unless-stopped
    depends_on:
      playbook-postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://playbook_user:playbook_secure_password@playbook-postgres:5432/playbook_db?sslmode=disable
    ports:
      - "8082:8082"
    networks:
      - thehive-net

volumes:
  # Khai báo volume mới độc lập dạng external
  playbook-postgres-data:
    external: true
```
*Lưu ý: Quản trị viên cần chạy `docker volume create playbook-postgres-data` trước khi khởi động stack.*

---

### Phương án B: Mô hình Dùng chung Cụm PostgreSQL (Tối ưu tài nguyên)
*Áp dụng khi tính năng mới chỉ là module phụ trợ nhỏ, dữ liệu ít, muốn tiết kiệm tối đa tài nguyên RAM/CPU trên máy chủ SOC.*

#### Cấu hình tự động khởi tạo database mới trên container Postgres hiện tại:
1.  **Tạo file script khởi tạo** `platform/deploy/scripts/init-multiple-databases.sql`:
    ```sql
    CREATE DATABASE thehive_analytics;
    CREATE USER analytics_user WITH PASSWORD 'analytics_secure_password';
    GRANT ALL PRIVILEGES ON DATABASE thehive_analytics TO analytics_user;
    ```
2.  **Mount script này vào container Postgres** trong file `docker-compose.yml`:
    ```yaml
    postgres:
      image: postgres:16-alpine
      container_name: ncs-fusion-postgres
      restart: unless-stopped
      environment:
        POSTGRES_DB: ${POSTGRES_DB:-thehive}
        POSTGRES_USER: ${POSTGRES_USER:-thehive}
        POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-thehive}
      volumes:
        - postgres-data:/var/lib/postgresql/data
        # Tự động chạy script khi khởi tạo container lần đầu
        - ./scripts/init-multiple-databases.sql:/docker-entrypoint-initdb.d/init-multiple-databases.sql:ro
      ports:
        - "${POSTGRES_PORT:-5432}:5432"
      networks:
        - thehive-net
    ```

---

## 5. Kịch Bản Nâng Cấp Hệ Thống Lên Kubernetes (K8s) Chuẩn Cloud-Native

Khi lượng dữ liệu sự cố SOC tăng trưởng vượt trội và hệ thống đòi hỏi tính sẵn sàng cao (High Availability - HA), việc chuyển đổi hạ tầng từ Docker Compose sang **Kubernetes (K8s)** là bước đi chiến lược bắt buộc.

```mermaid
graph TD
    %% Ingress & Routing
    Ingress[K8s Ingress Controller / Nginx] -->|HTTP Rule Port 80/443| FE_Svc[Frontend Service]
    Ingress -->|API Rule /api| BE_Svc[Backend Service]
    
    %% Stateful Service Access
    BE_Svc --> DB_Svc[Postgres Headless Service]
    BE_Svc --> MQ_Svc[RabbitMQ Headless Service]
    BE_Svc --> Object_Svc[MinIO Service]
    BE_Svc --> Search_Svc[OpenSearch Service]
    
    %% Pod Layout
    subgraph K8s Stateless Deployments (Co giãn tự động)
        FE_Svc -.-> FE_Pods[Frontend Pods: ReplicaSet]
        BE_Svc -.-> BE_Pods[Backend Pods: ReplicaSet]
        HPA_FE[HPA: CPU > 70%] --> FE_Pods
        HPA_BE[HPA: CPU > 70%] --> BE_Pods
    end
    
    subgraph K8s StatefulSets (Lưu trữ và định danh cố định)
        DB_Svc -.-> DB_Pod_0[Postgres Pod-0]
        DB_Svc -.-> DB_Pod_1[Postgres Pod-1]
        MQ_Svc -.-> MQ_Pod_0[RabbitMQ Pod-0]
        MQ_Svc -.-> MQ_Pod_1[RabbitMQ Pod-1]
        Object_Svc -.-> MinIO_Pods[MinIO Pods]
        Search_Svc -.-> Search_Pods[OpenSearch Pods]
    end
    
    %% Dynamic Storage Provisioning
    subgraph CSI Dynamic Provisioning (StorageClass)
        DB_Pod_0 & DB_Pod_1 -->|Claim| PVC_DB[PVC Postgres]
        MinIO_Pods -->|Claim| PVC_MinIO[PVC MinIO]
        Search_Pods -->|Claim| PVC_OS[PVC OpenSearch]
        PVC_DB & PVC_MinIO & PVC_OS -->|Auto-Create| PV[Persistent Volumes: EBS gp3/Ceph]
    end
```

---

### 5.1. Chuyển Đổi Tư Duy Kiến Trúc: Docker Compose sang K8s
*   **Docker Compose**: Thích hợp cho môi trường phát triển (Dev) hoặc hệ thống SOC cỡ nhỏ chạy trên một máy chủ vật lý duy nhất. Việc cấu hình IP tĩnh và liên kết qua mạng Docker Bridge là đủ.
*   **Kubernetes (K8s)**: Thiết kế cho môi trường Cloud-Native phân tán nhiều máy chủ (Multi-node Cluster). Đảm bảo tính tự phục hồi (Self-healing - tự động tạo lại Pod khi node vật lý bị sập), co giãn tự động (Horizontal Pod Autoscaling - HPA) và cập nhật không downtime (Rolling Update).

---

### 5.2. Ánh Xạ Tài Nguyên Hệ Thống Trên K8s (Mapping Resources)

Để triển khai NCS Fusion Center lên Kubernetes, chúng ta phân loại các dịch vụ thành 2 nhóm tài nguyên cơ bản:

#### A. Dịch vụ Stateless (Không lưu trạng thái) -> Sử dụng K8s `Deployment`
*   **Dịch vụ**: `frontend` (Next.js) và `backend` (Go Core).
*   **Đặc điểm**: Không lưu dữ liệu trực tiếp trong ổ đĩa của container. Khi có yêu cầu nâng cấp, K8s sẽ khởi chạy các Pod mới và tắt dần Pod cũ thông qua cơ chế **Rolling Update** mà không gây mất dữ liệu hay gián đoạn dịch vụ.
*   **Tự động co giãn (HPA)**: K8s sẽ tự động tăng/giảm số lượng bản sao (Replicas) của Pod dựa trên mức độ sử dụng CPU/RAM thực tế.

#### B. Dịch vụ Stateful (Có lưu trạng thái) -> Sử dụng K8s `StatefulSet`
*   **Dịch vụ**: `postgres`, `rabbitmq`, `minio`, `opensearch`, `misp-db` (MariaDB).
*   **Đặc điểm**: Cần định danh mạng cố định (ví dụ Pod-0, Pod-1) và yêu cầu gắn kết chính xác với một phân vùng ổ đĩa cố định dù Pod có bị restart sang node khác.
*   **Headless Service**: Sử dụng dịch vụ không có ClusterIP (Headless Service) để cho phép các dịch vụ tự tìm kiếm và kết nối trực tiếp với từng thành viên cụ thể trong cụm (ví dụ cụm RabbitMQ Clustering hoặc Postgres Primary-Replica).

---

### 5.3. Cơ Chế Lưu Trữ Động Chuẩn Doanh Nghiệp (CSI Storage Class)
Không khai báo ổ đĩa tĩnh dạng HostPath (tránh phụ thuộc vào một máy chủ cụ thể). Trên K8s, ta sử dụng:
1.  **StorageClass (SC)**: Định nghĩa nhà cung cấp lưu trữ (như AWS EBS CSI Driver cho Cloud, hoặc Ceph CSI, Longhorn, OpenEBS cho hệ thống On-Premise). Cấu hình chế độ tự động cấp phát ổ đĩa nhanh gp3 (`volumeBindingMode: WaitForFirstConsumer`).
2.  **PersistentVolumeClaim (PVC)**: Khai báo yêu cầu lưu trữ (ví dụ cần ổ SSD 50GB). K8s StatefulSet sẽ tự động tạo ra các PVC tương ứng cho từng Pod (ví dụ Pod `postgres-0` sẽ đi kèm PVC `postgres-data-postgres-0`).
3.  **PersistentVolume (PV)**: StorageClass lắng nghe PVC và tự động yêu cầu hệ thống SAN/NAS hoặc Cloud Provider khởi tạo một phân vùng ổ đĩa vật lý (PV) rồi mount trực tiếp vào Pod.

---

### 5.4. Cơ Chế Co Giãn Tự Động (Horizontal Pod Autoscaler - HPA)
Để hệ thống SOC Fusion Center luôn đứng vững trước các đợt bùng phát mã độc quy mô lớn khiến lượng log gửi về Backend tăng đột biến, cấu hình **HPA** sẽ tự động nhân bản số lượng Pods:

#### YAML Cấu hình HPA mẫu cho Go Core Backend:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ncs-backend-hpa
  namespace: ncs-soc
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ncs-fusion-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70 # Tự động scale khi CPU vượt ngưỡng 70%
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80 # Tự động scale khi RAM vượt ngưỡng 80%
```

---

### 5.5. Quản Lý Cấu Hình & Secrets An Toàn Trên K8s
*   **ConfigMap**: Dùng để quản lý các biến cấu hình thông thường như: `OPENSEARCH_INDEX_PREFIX`, `MISP_URL`, `JWT_EXPIRY`, `LOG_LEVEL` để lập trình viên dễ dàng điều chỉnh cấu hình hệ thống mà không cần build lại Docker image.
*   **Secrets**: Dùng để quản lý các thông tin tuyệt mật như: `POSTGRES_DSN`, `JWT_SECRET`, `S3_SECRET_ACCESS_KEY`.
    *   *Mô hình bảo mật GitOps*: Khi đưa cấu hình lên Git, các file Secret này **bắt buộc phải được mã hóa**. Chúng ta khuyến nghị sử dụng giải pháp **Sealed Secrets** (Bitnami) để biến các Secret thường thành các file mã hóa an toàn trên Git, chỉ có Controller chạy trong cụm K8s mới có khóa giải mã. Hoặc tích hợp **HashiCorp Vault** thông qua cơ chế *Vault Agent Injector* để chèn secret trực tiếp vào bộ nhớ tạm của Pod khi chạy.

---

### 5.6. Quy Trình CI/CD GitOps Hoàn Chỉnh Với ArgoCD
Để quản trị và vận hành hệ thống K8s chuẩn doanh nghiệp lớn, quy trình deploy thủ công sẽ được thay thế 100% bằng mô hình **GitOps**:

```mermaid
sequenceDiagram
    actor Developer as Lập trình viên SOC
    participant GitApp as Repo Mã Nguồn (App Repo)
    participant CI as Drone CI / GitHub Actions
    participant ECR as Docker Registry (Harbor / ECR)
    participant GitOps as Repo Cấu Hình K8s (GitOps Repo)
    participant ArgoCD as ArgoCD (Trong cụm K8s)
    participant K8s as K8s Cluster (SOC Nodes)

    Developer->>GitApp: Push code mới (golang/nextjs)
    GitApp->>CI: Trigger Build Pipeline
    CI->>CI: Chạy Unit Test & Quét lỗi bảo mật
    CI->>ECR: Build Docker Image & Push tag (v0.4.1)
    CI->>GitOps: Tự động cập nhật file values.yaml (image.tag = v0.4.1)
    ArgoCD->>GitOps: Liên tục lắng nghe sự thay đổi (Polling/Webhook)
    ArgoCD->>K8s: Phát hiện sự sai lệch cấu hình (Out of Sync)
    ArgoCD->>K8s: Tự động đồng bộ hóa (Sync) & Rolling Update Pods
    K8s-->>Developer: Hoàn tất cập nhật hệ thống không downtime!
```

---

### 5.7. File YAML Khai Báo Tài Nguyên Thực Tế (Deployment & Service Mẫu)

Dưới đây là tệp tin YAML khai báo K8s Manifest tiêu chuẩn để triển khai dịch vụ Core Backend, giúp đội ngũ DevOps sẵn sàng áp dụng ngay lập tức:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ncs-fusion-backend
  namespace: ncs-soc
  labels:
    app: ncs-fusion-backend
spec:
  replicas: 2 # Khởi chạy mặc định 2 bản sao để đảm bảo HA
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1 # Cho phép chạy thêm tối đa 1 Pod mới trong lúc nâng cấp
      maxUnavailable: 0 # Đảm bảo luôn có ít nhất 2 Pod hoạt động trong suốt quá trình update
  selector:
    matchLabels:
      app: ncs-fusion-backend
  template:
    metadata:
      labels:
        app: ncs-fusion-backend
    spec:
      containers:
      - name: backend
        image: harbor.ncs.local/soc/ncs-fusion-backend:0.4.0-migration
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8080
          name: http-api
        # Khai báo cấu hình tài nguyên (Resource Requests & Limits) để HPA hoạt động chính xác
        resources:
          requests:
            cpu: "250m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1024Mi"
        # Kiểm tra trạng thái sống sót của tiến trình (Liveness Probe)
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
        # Kiểm tra độ sẵn sàng phục vụ lưu lượng (Readiness Probe)
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        environmentFrom:
        - configMapRef:
            name: ncs-backend-config
        - secretRef:
            name: ncs-backend-secrets

---
apiVersion: v1
kind: Service
metadata:
  name: ncs-fusion-backend
  namespace: ncs-soc
spec:
  selector:
    app: ncs-fusion-backend
  ports:
  - protocol: TCP
    port: 8080
    targetPort: 8080
    name: http-api
  type: ClusterIP # Cung cấp IP nội bộ cụm K8s
```

---

## 6. Kết Luận & Định Hướng Phát Triển

Hạ tầng hiện tại của **NCS Fusion Center** đã được chuẩn hóa ở mức độ cực kỳ gọn gàng, loại bỏ hoàn toàn mã nguồn cũ và vận hành hoàn hảo trên Docker External Volumes. Đây là tiền đề cực kỳ vững chắc để bảo vệ tính toàn vẹn của dữ liệu SOC trong giai đoạn Go-Live.

Khi hệ thống mở rộng quy mô, việc dịch chuyển sang **Kubernetes (K8s)** bằng cách tận dụng các mô hình StatefulSet (được ánh xạ sang PVC StorageClass động) và mô hình Deployment Stateless (kết hợp cơ chế co giãn tự động HPA) đã được hoạch định sẵn sàng trong tài liệu này, giúp đội ngũ kỹ thuật có thể dễ dàng hiện thực hóa hạ tầng cấp doanh nghiệp lớn chỉ trong vài bước cấu hình DevOps.
