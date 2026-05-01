package storage

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

type Config struct {
	Endpoint        string
	PublicEndpoint  string
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	UsePathStyle    bool
	UploadTTL       time.Duration
	DownloadTTL     time.Duration
}

type Client struct {
	cfg Config
}

func NewClient(cfg Config) *Client {
	if cfg.Region == "" {
		cfg.Region = "us-east-1"
	}
	if cfg.UploadTTL == 0 {
		cfg.UploadTTL = 15 * time.Minute
	}
	if cfg.DownloadTTL == 0 {
		cfg.DownloadTTL = 5 * time.Minute
	}
	return &Client{cfg: cfg}
}

func (c *Client) Bucket() string { return c.cfg.Bucket }

func (c *Client) PresignUpload(objectKey string, contentType string) (string, time.Time, error) {
	return c.presign("PUT", objectKey, contentType, c.cfg.UploadTTL)
}

func (c *Client) PresignDownload(objectKey string) (string, time.Time, error) {
	return c.presign("GET", objectKey, "", c.cfg.DownloadTTL)
}

func (c *Client) FetchObject(objectKey string) ([]byte, error) {
	url, _, err := c.presignWithEndpoint("GET", objectKey, "", c.cfg.DownloadTTL, c.cfg.Endpoint)
	if err != nil {
		return nil, err
	}
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("fetch object failed with status %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func (c *Client) presign(method string, objectKey string, contentType string, ttl time.Duration) (string, time.Time, error) {
	return c.presignWithEndpoint(method, objectKey, contentType, ttl, c.publicEndpoint())
}

func (c *Client) presignWithEndpoint(method string, objectKey string, contentType string, ttl time.Duration, endpoint string) (string, time.Time, error) {
	if strings.TrimSpace(c.cfg.Endpoint) == "" || strings.TrimSpace(c.cfg.AccessKeyID) == "" || strings.TrimSpace(c.cfg.SecretAccessKey) == "" || strings.TrimSpace(c.cfg.Bucket) == "" {
		return "", time.Time{}, fmt.Errorf("s3 storage is not configured")
	}
	now := time.Now().UTC()
	expires := now.Add(ttl)
	hostURL, err := c.objectURLWithEndpoint(objectKey, endpoint)
	if err != nil {
		return "", time.Time{}, err
	}
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, c.cfg.Region)
	query := hostURL.Query()
	query.Set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	query.Set("X-Amz-Credential", c.cfg.AccessKeyID+"/"+credentialScope)
	query.Set("X-Amz-Date", amzDate)
	query.Set("X-Amz-Expires", fmt.Sprintf("%d", int(ttl.Seconds())))
	query.Set("X-Amz-SignedHeaders", signedHeaders(contentType))
	hostURL.RawQuery = canonicalQuery(query)
	canonicalHeaders := "host:" + hostURL.Host + "\n"
	if contentType != "" {
		canonicalHeaders += "content-type:" + strings.TrimSpace(contentType) + "\n"
	}
	canonicalRequest := strings.Join([]string{method, canonicalURI(hostURL.EscapedPath()), canonicalQuery(query), canonicalHeaders, signedHeaders(contentType), "UNSIGNED-PAYLOAD"}, "\n")
	stringToSign := strings.Join([]string{"AWS4-HMAC-SHA256", amzDate, credentialScope, hexSHA256(canonicalRequest)}, "\n")
	signature := hex.EncodeToString(hmacSHA256(signingKey(c.cfg.SecretAccessKey, dateStamp, c.cfg.Region), stringToSign))
	query.Set("X-Amz-Signature", signature)
	hostURL.RawQuery = canonicalQuery(query)
	return hostURL.String(), expires, nil
}

func (c *Client) publicEndpoint() string {
	if c.cfg.PublicEndpoint != "" {
		return c.cfg.PublicEndpoint
	}
	return c.cfg.Endpoint
}

func (c *Client) objectURL(objectKey string) (*url.URL, error) {
	return c.objectURLWithEndpoint(objectKey, c.publicEndpoint())
}

func (c *Client) objectURLWithEndpoint(objectKey string, endpoint string) (*url.URL, error) {
	base, err := url.Parse(strings.TrimRight(endpoint, "/"))
	if err != nil {
		return nil, err
	}
	keyPath := strings.TrimLeft(objectKey, "/")
	if c.cfg.UsePathStyle {
		base.Path = strings.TrimRight(base.Path, "/") + "/" + c.cfg.Bucket + "/" + keyPath
	} else {
		base.Host = c.cfg.Bucket + "." + base.Host
		base.Path = strings.TrimRight(base.Path, "/") + "/" + keyPath
	}
	return base, nil
}

func signedHeaders(contentType string) string {
	if contentType != "" {
		return "content-type;host"
	}
	return "host"
}

func canonicalURI(path string) string {
	if path == "" {
		return "/"
	}
	return path
}

func canonicalQuery(values url.Values) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		vals := append([]string(nil), values[key]...)
		sort.Strings(vals)
		for _, value := range vals {
			parts = append(parts, url.QueryEscape(key)+"="+url.QueryEscape(value))
		}
	}
	return strings.ReplaceAll(strings.Join(parts, "&"), "+", "%20")
}

func signingKey(secret string, date string, region string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), date)
	kRegion := hmacSHA256(kDate, region)
	kService := hmacSHA256(kRegion, "s3")
	return hmacSHA256(kService, "aws4_request")
}

func hmacSHA256(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	_, _ = h.Write([]byte(data))
	return h.Sum(nil)
}

func hexSHA256(data string) string {
	sum := sha256.Sum256([]byte(data))
	return hex.EncodeToString(sum[:])
}
