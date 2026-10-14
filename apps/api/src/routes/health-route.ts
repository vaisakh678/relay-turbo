import { Hono } from "hono";

const healthRoute = new Hono();

healthRoute.get("/", (c) => c.json({ data: { status: "ok", uptime: process.uptime() }, error: null }));

export default healthRoute;
