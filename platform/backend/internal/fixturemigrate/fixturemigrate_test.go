package fixturemigrate

import (
	"path/filepath"
	"testing"
)

func TestReadLegacyFixtureJSON(t *testing.T) {
	fixtureDir := filepath.Clean("../../../../thehive/test/resources/data")
	cases, caseChecksum, err := readJSON[legacyCase](filepath.Join(fixtureDir, "Case.json"))
	if err != nil {
		t.Fatalf("read cases: %v", err)
	}
	if len(cases) == 0 || cases[0].ID == "" || caseChecksum == "" {
		t.Fatalf("unexpected cases len=%d first=%#v checksum=%q", len(cases), cases[0], caseChecksum)
	}
	alerts, alertChecksum, err := readJSON[legacyAlert](filepath.Join(fixtureDir, "Alert.json"))
	if err != nil {
		t.Fatalf("read alerts: %v", err)
	}
	if len(alerts) == 0 || alerts[0].ID == "" || alertChecksum == "" {
		t.Fatalf("unexpected alerts len=%d first=%#v checksum=%q", len(alerts), alerts[0], alertChecksum)
	}
	observables, observableChecksum, err := readJSON[legacyObservable](filepath.Join(fixtureDir, "Observable.json"))
	if err != nil {
		t.Fatalf("read observables: %v", err)
	}
	if len(observables) == 0 || observables[0].ID == "" || observableChecksum == "" {
		t.Fatalf("unexpected observables len=%d first=%#v checksum=%q", len(observables), observables[0], observableChecksum)
	}
}
