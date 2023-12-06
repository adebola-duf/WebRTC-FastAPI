import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Store active WebSocket connections
connected_websockets: dict[int, WebSocket] = {}


@app.websocket("/ws/{id}")
async def websocket_endpoint(websocket: WebSocket, id: int):
    await websocket.accept()
    connected_websockets[id] = websocket
    try:
        while True:
            # await websocket.send_text("fafas")
            data = await websocket.receive_text()

            data = json.loads(data)

            if data["action"] == "join":
                user_id = data["user_id"]
                room = data["room"]
                print(f"RoomEvent: {user_id} has joined the room {room}")
                # print(connected_websockets)
                for ids, ws in connected_websockets.items():
                    if ids != user_id:
                        await connected_websockets[ids].send_json({"action": "ready", "user_id": user_id})

            elif data["action"] == "data":
                user_id = data['user_id']
                room = data['room']
                data = data['data']
                print('DataEvent: {} has sent the data:\n {}\n'.format(user_id, data))

                for ids, ws in connected_websockets.items():
                    if ids != user_id:
                        await connected_websockets[ids].send_json({"action": "data", "data": data})

    except WebSocketDisconnect:
        print(f"{id} just left")
        del connected_websockets[id]


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
