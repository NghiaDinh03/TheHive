package handler

import (
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
)

type CorrelationHandler struct {
	db *sqlx.DB
}

func NewCorrelationHandler(db *sqlx.DB) *CorrelationHandler {
	return &CorrelationHandler{db: db}
}

type GraphNode struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Type  string `json:"type"` // "case" or "observable"
	TLP   int    `json:"tlp,omitempty"`
}

type GraphLink struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type GraphResponse struct {
	Nodes []GraphNode `json:"nodes"`
	Links []GraphLink `json:"links"`
}

type correlationRow struct {
	OtherCaseID    string `db:"other_case_id"`
	OtherCaseTitle string `db:"other_case_title"`
	OtherCaseTLP   int    `db:"other_case_tlp"`
	OtherObsID     string `db:"other_obs_id"`
	DataType       string `db:"data_type"`
	Data           string `db:"data"`
	OtherObsTLP    int    `db:"other_obs_tlp"`
	CurrObsID      string `db:"curr_obs_id"`
}

func (h *CorrelationHandler) GetCaseCorrelation(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	if caseID == "" {
		return apierr.New(http.StatusBadRequest, "Case ID is required")
	}

	ctx := c.Request().Context()

	// 1. Verify that the current case exists and get its title/TLP
	var currentCase struct {
		ID    string `db:"id"`
		Title string `db:"title"`
		TLP   int    `db:"tlp"`
	}
	err := h.db.GetContext(ctx, &currentCase, "SELECT id::text AS id, title, tlp FROM cases WHERE id = $1::uuid", caseID)
	if err != nil {
		return apierr.New(http.StatusNotFound, "Case not found")
	}

	// 2. Fetch all observables belonging to the current case
	type obsRow struct {
		ID       string `db:"id"`
		DataType string `db:"data_type"`
		Data     string `db:"data"`
		TLP      int    `db:"tlp"`
	}
	var currentObservables []obsRow
	err = h.db.SelectContext(ctx, &currentObservables, 
		"SELECT id::text AS id, data_type, data, tlp FROM observables WHERE case_id = $1::uuid", caseID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to query case observables")
	}

	// 3. Find correlations in other cases
	var rows []correlationRow
	query := `
		SELECT o.case_id::text AS other_case_id, c.title AS other_case_title, c.tlp AS other_case_tlp,
		       o.id::text AS other_obs_id, o.data_type, o.data, o.tlp AS other_obs_tlp,
		       curr.id::text AS curr_obs_id
		FROM observables curr
		JOIN observables o ON lower(curr.data_type) = lower(o.data_type) AND lower(curr.data) = lower(o.data)
		JOIN cases c ON o.case_id = c.id
		WHERE curr.case_id = $1::uuid AND o.case_id <> $1::uuid AND o.case_id IS NOT NULL
	`
	err = h.db.SelectContext(ctx, &rows, query, caseID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to query observable correlations")
	}

	// 4. Construct Nodes & Links map
	nodesMap := make(map[string]GraphNode)
	var links []GraphLink

	// Center node: the current case
	nodesMap[currentCase.ID] = GraphNode{
		ID:    currentCase.ID,
		Label: currentCase.Title,
		Type:  "case",
		TLP:   currentCase.TLP,
	}

	// Add all current observables as nodes and link them to the center case
	for _, obs := range currentObservables {
		nodesMap[obs.ID] = GraphNode{
			ID:    obs.ID,
			Label: obs.DataType + ": " + obs.Data,
			Type:  "observable",
			TLP:   obs.TLP,
		}
		links = append(links, GraphLink{
			Source: currentCase.ID,
			Target: obs.ID,
		})
	}

	// Process correlations
	for _, row := range rows {
		// Add other case node if not present
		if _, exists := nodesMap[row.OtherCaseID]; !exists {
			nodesMap[row.OtherCaseID] = GraphNode{
				ID:    row.OtherCaseID,
				Label: row.OtherCaseTitle,
				Type:  "case",
				TLP:   row.OtherCaseTLP,
			}
		}

		// Link current matching observable to other case
		links = append(links, GraphLink{
			Source: row.CurrObsID,
			Target: row.OtherCaseID,
		})
	}

	// Flatten nodes map into a slice
	nodes := make([]GraphNode, 0, len(nodesMap))
	for _, node := range nodesMap {
		nodes = append(nodes, node)
	}

	return c.JSON(http.StatusOK, GraphResponse{
		Nodes: nodes,
		Links: links,
	})
}
