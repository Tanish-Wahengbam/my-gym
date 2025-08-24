import express from "express";
import router from "./src/service.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "src/views")));
app.use("/css", express.static(path.join(__dirname, "src/css")));
app.use("/images", express.static(path.join(__dirname, "src/images")));
app.use("/api", router);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/src/views/", "leads.html"));
});
app.get("/refer-friends", (req, res) => {
    res.sendFile(path.join(__dirname, "/src/views/", "referral.html"));
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
