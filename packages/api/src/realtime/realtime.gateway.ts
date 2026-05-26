import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: "http://localhost:5173" } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    client.emit("connected", { ts: Date.now() });
  }

  @SubscribeMessage("join:project")
  handleJoin(client: Socket, projectId: string) {
    client.join(`project:${projectId}`);
    return { joined: projectId };
  }

  broadcast(projectId: string, event: string, payload: unknown) {
    this.server?.to(`project:${projectId}`).emit(event, payload);
  }
}
