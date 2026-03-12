import { httpRouter } from "convex/server";
import { registerAuthRoutes } from "./auth";
import { registerDiscordBotRoutes } from "./discordBot";

const http = httpRouter();

registerAuthRoutes(http);
registerDiscordBotRoutes(http);

export default http;
