package investigation

import "testing"

func TestParseTheHiveDSLLogicalOperators(t *testing.T) {
	expr, err := ParseTheHiveDSL(`{"_and":[{"status":"Open"},{"severity":{"_gt":2}},{"title":{"_like":"phish"}}]}`, fieldMap{"status": "c.status", "severity": "c.severity", "title": "c.title"})
	if err != nil {
		t.Fatalf("ParseTheHiveDSL failed: %v", err)
	}
	if expr.SQL == "" || len(expr.Args) != 3 {
		t.Fatalf("unexpected expression: %#v", expr)
	}
}

func TestParseTheHiveDSLRangeAndIn(t *testing.T) {
	expr, err := ParseTheHiveDSL(`{"_or":[{"severity":{"_between":[1,3]}},{"status":{"_in":["Open","Resolved"]}}]}`, fieldMap{"severity": "c.severity", "status": "c.status"})
	if err != nil {
		t.Fatalf("ParseTheHiveDSL failed: %v", err)
	}
	if len(expr.Args) != 4 {
		t.Fatalf("expected 4 args, got %d: %#v", len(expr.Args), expr)
	}
}

func TestParseTheHiveDSLNot(t *testing.T) {
	expr, err := ParseTheHiveDSL(`{"_not":{"status":"Deleted"}}`, fieldMap{"status": "c.status"})
	if err != nil {
		t.Fatalf("ParseTheHiveDSL failed: %v", err)
	}
	if expr.SQL == "" || len(expr.Args) != 1 {
		t.Fatalf("unexpected expression: %#v", expr)
	}
}
