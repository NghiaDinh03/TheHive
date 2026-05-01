package tests

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

const documentedAdminPassword = "12345@"
const documentedAdminHash = "$2a$10$df0oYFlmSfEFYZsnph9pVe866YEN/NbrcgcYOBromzea9o9HoRbxu"

func TestSeedPasswordHashMatchesDocumentedAdminPassword(t *testing.T) {
	if err := bcrypt.CompareHashAndPassword([]byte(documentedAdminHash), []byte(documentedAdminPassword)); err != nil {
		t.Fatalf("documented admin password does not match seed bcrypt hash: %v", err)
	}
}
