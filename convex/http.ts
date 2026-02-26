import { httpRouter } from "convex/server";
import { registerAuthRoutes } from "./auth";

const http = httpRouter();

registerAuthRoutes(http);

export default http;
