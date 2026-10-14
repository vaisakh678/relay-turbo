import { Hono } from "hono";

import appRoute from "./app-route";
import chatRoute from "./chat-route";
import healthRoute from "./health-route";
import logRoute from "./log-route";
import providerKeyRoute from "./provider-key-route";

const appRoutes = new Hono();

appRoutes.route("/health", healthRoute);
appRoutes.route("/apps", appRoute);
appRoutes.route("/provider-keys", providerKeyRoute);
appRoutes.route("/logs", logRoute);
appRoutes.route("/chat", chatRoute);

export default appRoutes;
