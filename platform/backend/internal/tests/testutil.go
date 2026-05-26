package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
)

// baseURL is the API base URL for smoke tests.
// Duplicated here because testutil.go is a non-test file and cannot
// reference consts from *_test.go files.
const baseURL = "http://127.0.0.1:8089"

// loginHelper performs login and returns admin token.
// Used by F2-F6 tests to avoid depending on TestA2_LoginAndAuth ordering.
func loginHelper() (string, error) {
	loginReq := map[string]string{
		"login":    "ncs_admin@ncsgroup.vn",
		"password": "12345@",
	}
	body, _ := json.Marshal(loginReq)
	resp, err := http.Post(baseURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var loginResp struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
		return "", err
	}
	return loginResp.Token, nil
}
