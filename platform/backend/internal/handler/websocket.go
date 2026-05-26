package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/authjwt"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev/test
	},
}

type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	CaseID   string
	Username string
}

type WSMessage struct {
	Type     string `json:"type"` // "user_join", "user_leave", "activity", "presence"
	Username string `json:"username"`
	CaseID   string `json:"case_id"`
	Payload  any    `json:"payload,omitempty"`
}

type Hub struct {
	rooms      map[string]map[*Client]bool // map of CaseID -> Set of Clients
	broadcast  chan WSMessage
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

var globalHub *Hub
var hubOnce sync.Once

func GetHub() *Hub {
	hubOnce.Do(func() {
		globalHub = &Hub{
			rooms:      make(map[string]map[*Client]bool),
			broadcast:  make(chan WSMessage),
			register:   make(chan *Client),
			unregister: make(chan *Client),
		}
		go globalHub.Run()
	})
	return globalHub
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, exists := h.rooms[client.CaseID]; !exists {
				h.rooms[client.CaseID] = make(map[*Client]bool)
			}
			h.rooms[client.CaseID][client] = true
			h.mu.Unlock()

			// Broadcast presence update
			h.broadcastPresence(client.CaseID)

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, exists := h.rooms[client.CaseID]; exists {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.Send)
					if len(clients) == 0 {
						delete(h.rooms, client.CaseID)
					}
				}
			}
			h.mu.Unlock()

			// Broadcast presence update
			h.broadcastPresence(client.CaseID)

		case msg := <-h.broadcast:
			h.mu.RLock()
			clients := h.rooms[msg.CaseID]
			if len(clients) > 0 {
				data, err := json.Marshal(msg)
				if err == nil {
					for client := range clients {
						select {
						case client.Send <- data:
						default:
							close(client.Send)
							h.mu.RUnlock()
							h.mu.Lock()
							delete(clients, client)
							if len(clients) == 0 {
								delete(h.rooms, client.CaseID)
							}
							h.mu.Unlock()
							h.mu.RLock()
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) broadcastPresence(caseID string) {
	h.mu.RLock()
	clients := h.rooms[caseID]
	var activeUsers []string
	seen := make(map[string]bool)

	for client := range clients {
		if !seen[client.Username] {
			seen[client.Username] = true
			activeUsers = append(activeUsers, client.Username)
		}
	}
	h.mu.RUnlock()

	h.broadcast <- WSMessage{
		Type:    "presence",
		CaseID:  caseID,
		Payload: activeUsers,
	}
}

func (h *Hub) BroadcastActivity(caseID, username, action string, details any) {
	h.broadcast <- WSMessage{
		Type:     "activity",
		CaseID:   caseID,
		Username: username,
		Payload: map[string]any{
			"action":  action,
			"details": details,
		},
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(4096)
	_ = c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
		// Analysts are mostly passive receivers, but if they send text, we keep connection active
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)

			// Add queued messages to the current websocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				_, _ = w.Write([]byte{'\n'})
				_, _ = w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

type WebSocketHandler struct {
	db *sqlx.DB
}

func NewWebSocketHandler(db *sqlx.DB) *WebSocketHandler {
	return &WebSocketHandler{db: db}
}

func (h *WebSocketHandler) HandleCaseRoom(c echo.Context) error {
	caseID := c.Param("id")
	if caseID == "" {
		return c.String(http.StatusBadRequest, "Case ID required")
	}

	// Verify JWT claims from context to authorize user
	claims, ok := c.Get("auth_claims").(*authjwt.Claims)
	if !ok || claims == nil {
		// Fallback: parse token from query parameter "token" for WebSocket upgrade
		tokenStr := c.QueryParam("token")
		if tokenStr == "" {
			return c.String(http.StatusUnauthorized, "Unauthorized: missing token")
		}
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "please-change-me-please-change-me-32+"
		}
		var err error
		claims, err = authjwt.Parse(secret, tokenStr)
		if err != nil {
			return c.String(http.StatusUnauthorized, "Unauthorized: invalid token")
		}
	}

	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}

	hub := GetHub()
	client := &Client{
		Hub:      hub,
		Conn:     ws,
		Send:     make(chan []byte, 256),
		CaseID:   caseID,
		Username: claims.Login,
	}
	client.Hub.register <- client

	go client.WritePump()
	go client.ReadPump()

	return nil
}

// BroadcastHelper automatically pushes events from write endpoints to WS
func BroadcastWSActivity(ctx context.Context, db *sqlx.DB, caseID, actor, action string, details any) {
	if caseID == "" {
		return
	}
	// Broadcast action to the Hub
	GetHub().BroadcastActivity(caseID, actor, action, details)
}
