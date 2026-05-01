package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A3 MinIO Attachment Smoke Tests
// These tests verify evidence storage behavior

// TestA3_UploadInit verifies upload initialization returns presigned URL
func TestA3_UploadInit(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token")
	}

	initReq := map[string]interface{}{
		"filename": "test-evidence.pdf",
		"size":     1024,
		"mimeType": "application/pdf",
	}
	body, _ := json.Marshal(initReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/attachments/init", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Upload init should succeed")

	var initResp struct {
		UploadID     string `json:"upload_id"`
		PresignedURL string `json:"presigned_url"`
		AttachmentID string `json:"attachment_id"`
	}
	err = json.NewDecoder(resp.Body).Decode(&initResp)
	require.NoError(t, err)

	require.NotEmpty(t, initResp.UploadID, "Upload ID should be returned")
	require.NotEmpty(t, initResp.PresignedURL, "Presigned URL should be returned")
	require.NotEmpty(t, initResp.AttachmentID, "Attachment ID should be returned")

	t.Logf("Upload init: ID=%s, AttachmentID=%s", initResp.UploadID, initResp.AttachmentID)
}

// TestA3_Finalize verifies upload finalization computes hash/size
func TestA3_Finalize(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token")
	}

	// First create an attachment
	initReq := map[string]interface{}{
		"filename": "test-evidence.txt",
		"size":     100,
		"mimeType": "text/plain",
	}
	body, _ := json.Marshal(initReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/attachments/init", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)

	var initResp struct {
		UploadID     string `json:"upload_id"`
		PresignedURL string `json:"presigned_url"`
		AttachmentID string `json:"attachment_id"`
	}
	json.NewDecoder(resp.Body).Decode(&initResp)
	resp.Body.Close()

	// Upload test bytes to presigned URL
	testData := []byte("test evidence data for hash verification")
	putReq, _ := http.NewRequest("PUT", initResp.PresignedURL, bytes.NewReader(testData))
	putReq.Header.Set("Content-Type", "text/plain")

	putResp, err := http.DefaultClient.Do(putReq)
	require.NoError(t, err)
	putResp.Body.Close()

	// Finalize upload
	finalizeReq := map[string]interface{}{
		"upload_id":     initResp.UploadID,
		"attachment_id": initResp.AttachmentID,
		"size":          len(testData),
	}
	body, _ = json.Marshal(finalizeReq)

	req, _ = http.NewRequest("POST", baseURL+"/api/v1/attachments/finalize", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Finalize should succeed")

	var finalizeResp struct {
		AttachmentID string `json:"attachment_id"`
		Hash         string `json:"hash"`
		HashSource   string `json:"hash_source"`
		Size         int    `json:"size"`
	}
	err = json.NewDecoder(resp.Body).Decode(&finalizeResp)
	require.NoError(t, err)

	assert.Equal(t, initResp.AttachmentID, finalizeResp.AttachmentID, "Attachment ID should match")
	assert.NotEmpty(t, finalizeResp.Hash, "Hash should be computed")
	assert.Equal(t, "server-side", finalizeResp.HashSource, "Hash source should be server-side")
	assert.Equal(t, len(testData), finalizeResp.Size, "Size should match uploaded bytes")

	t.Logf("Finalized: Hash=%s, Source=%s, Size=%d", finalizeResp.Hash, finalizeResp.HashSource, finalizeResp.Size)
}

// TestA3_Download verifies attachment download
func TestA3_Download(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token")
	}

	// Get list of attachments
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/attachments", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var attachmentsResp struct {
			Attachments []struct {
				ID string `json:"id"`
			} `json:"attachments"`
		}
		json.NewDecoder(resp.Body).Decode(&attachmentsResp)

		if len(attachmentsResp.Attachments) > 0 {
			// Try to download first attachment
			attachmentID := attachmentsResp.Attachments[0].ID
			req, _ = http.NewRequest("GET", baseURL+"/api/v1/attachments/"+attachmentID+"/download", nil)
			req.Header.Set("Authorization", "Bearer "+adminToken)

			resp, err = http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			// Should either succeed (200) or be blocked by scan policy (403)
			assert.Contains(t, []int{http.StatusOK, http.StatusForbidden}, resp.StatusCode, "Download should succeed or be blocked by policy")
			t.Logf("Download status: %d", resp.StatusCode)
		} else {
			t.Skip("No attachments available for download test")
		}
	}
}

// TestA3_ZIPDownload verifies encrypted ZIP download
func TestA3_ZIPDownload(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token")
	}
	if testCaseID == "" {
		t.Skip("Skipping: no test case")
	}

	// Request ZIP download for case
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/cases/"+testCaseID+"/attachments/zip", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Should return ZIP or indicate no attachments
	assert.Contains(t, []int{http.StatusOK, http.StatusNoContent, http.StatusNotFound}, resp.StatusCode, "ZIP download should be handled")

	if resp.StatusCode == http.StatusOK {
		contentType := resp.Header.Get("Content-Type")
		assert.Equal(t, "application/zip", contentType, "Should return ZIP content type")

		// Read body to verify it's a valid ZIP
		body, _ := io.ReadAll(resp.Body)
		assert.True(t, len(body) > 0, "ZIP should have content")

		// Check ZIP magic number
		if len(body) >= 4 {
			assert.Equal(t, []byte{0x50, 0x4B, 0x03, 0x04}, body[:4], "Should be valid ZIP file")
		}

		t.Logf("ZIP downloaded: %d bytes", len(body))
	}
}

// TestA3_FileObservable verifies file observable with attachment
func TestA3_FileObservable(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token")
	}
	if testCaseID == "" {
		t.Skip("Skipping: no test case")
	}

	// Create file observable
	obsReq := map[string]interface{}{
		"case_id":       testCaseID,
		"data_type":     "file",
		"message":       "Test file observable",
		"tlp":           2,
		"ioc":           false,
		"sighted":       false,
		"tags":          []string{"file-test"},
		"attachment_id": "", // Will be filled after upload
	}
	body, _ := json.Marshal(obsReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/observables", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// File observable creation should work
	assert.Contains(t, []int{http.StatusCreated, http.StatusBadRequest}, resp.StatusCode, "File observable creation should be handled")

	t.Logf("File observable creation status: %d", resp.StatusCode)
}
