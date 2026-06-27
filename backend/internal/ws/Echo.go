package ws

import (
	"log/slog"
	"net/http"

	"github.com/coder/websocket"
)


func HandleEcho(logger *slog.Logger, allowedOrigins []string ) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request){
		conn, err := websocket.Accept(w,r, &websocket.AcceptOptions{
			OriginPatterns: allowedOrigins,
		})
		if err != nil {
			logger.Error("ws accept failed", "err", err)
			return
		}
		defer conn.CloseNow()
		
		ctx := r.Context()
		
		for {
			typ, data, err := conn.Read(ctx)
			if err != nil {
				logger.Info("ws read ended", "err", err)
				return
			}
			err2 := conn.Write(ctx,typ,data)
			if err2 != nil {
				logger.Error("ws write failed", "err", err2)
				return
			}
		}

	}
}