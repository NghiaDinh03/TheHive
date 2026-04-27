package investigation

import (
	"encoding/json"
	"fmt"
	"strings"
)

type DSLExpr struct {
	SQL  string
	Args []any
}

type fieldMap map[string]string

func ParseTheHiveDSL(raw string, fields fieldMap) (DSLExpr, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return DSLExpr{}, nil
	}
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return DSLExpr{}, err
	}
	return compileDSL(value, fields)
}

func compileDSL(value any, fields fieldMap) (DSLExpr, error) {
	obj, ok := value.(map[string]any)
	if !ok {
		return DSLExpr{}, fmt.Errorf("dsl expression must be object")
	}
	parts := []string{}
	args := []any{}
	for key, raw := range obj {
		switch key {
		case "_and", "_or":
			items, ok := raw.([]any)
			if !ok {
				return DSLExpr{}, fmt.Errorf("%s expects array", key)
			}
			subParts := []string{}
			for _, item := range items {
				expr, err := compileDSL(item, fields)
				if err != nil {
					return DSLExpr{}, err
				}
				if expr.SQL != "" {
					subParts = append(subParts, "("+shiftPlaceholders(expr.SQL, len(args))+")")
					args = append(args, expr.Args...)
				}
			}
			joiner := " AND "
			if key == "_or" {
				joiner = " OR "
			}
			if len(subParts) > 0 {
				parts = append(parts, strings.Join(subParts, joiner))
			}
		case "_not":
			expr, err := compileDSL(raw, fields)
			if err != nil {
				return DSLExpr{}, err
			}
			if expr.SQL != "" {
				parts = append(parts, "NOT ("+shiftPlaceholders(expr.SQL, len(args))+")")
				args = append(args, expr.Args...)
			}
		default:
			column, ok := fields[key]
			if !ok {
				continue
			}
			expr, err := compileField(column, raw)
			if err != nil {
				return DSLExpr{}, err
			}
			if expr.SQL != "" {
				parts = append(parts, shiftPlaceholders(expr.SQL, len(args)))
				args = append(args, expr.Args...)
			}
		}
	}
	return DSLExpr{SQL: strings.Join(parts, " AND "), Args: args}, nil
}

func compileField(column string, raw any) (DSLExpr, error) {
	obj, ok := raw.(map[string]any)
	if !ok {
		return DSLExpr{SQL: column + " = $1", Args: []any{raw}}, nil
	}
	parts := []string{}
	args := []any{}
	for op, value := range obj {
		switch op {
		case "_like":
			args = append(args, value)
			parts = append(parts, fmt.Sprintf("%s ILIKE '%%' || $%d || '%%'", column, len(args)))
		case "_gt":
			args = append(args, value)
			parts = append(parts, fmt.Sprintf("%s > $%d", column, len(args)))
		case "_lt":
			args = append(args, value)
			parts = append(parts, fmt.Sprintf("%s < $%d", column, len(args)))
		case "_between":
			items, ok := value.([]any)
			if !ok || len(items) != 2 {
				return DSLExpr{}, fmt.Errorf("_between expects two-item array")
			}
			args = append(args, items[0], items[1])
			parts = append(parts, fmt.Sprintf("%s BETWEEN $%d AND $%d", column, len(args)-1, len(args)))
		case "_in":
			items, ok := value.([]any)
			if !ok || len(items) == 0 {
				return DSLExpr{}, fmt.Errorf("_in expects non-empty array")
			}
			placeholders := []string{}
			for _, item := range items {
				args = append(args, item)
				placeholders = append(placeholders, fmt.Sprintf("$%d", len(args)))
			}
			parts = append(parts, fmt.Sprintf("%s IN (%s)", column, strings.Join(placeholders, ",")))
		}
	}
	return DSLExpr{SQL: strings.Join(parts, " AND "), Args: args}, nil
}

func shiftPlaceholders(sql string, offset int) string {
	if offset == 0 {
		return sql
	}
	for i := 50; i >= 1; i-- {
		sql = strings.ReplaceAll(sql, fmt.Sprintf("$%d", i), fmt.Sprintf("$%d", i+offset))
	}
	return sql
}
