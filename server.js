const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/*MIDDLEWARE*/
app.use(express.json());
app.use(express.static("views"));
app.use("/css", express.static("public/css"));
app.use("/js", express.static("public/js"));
app.use("/uploads", express.static("uploads"));

/* UPLOAD STORAGE*/
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

/* DATABASE FILE SETUP */
const dbDir = path.join(__dirname, "data");
const dbFile = path.join(dbDir, "data.json");

/* Ensure folder + file exists */
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, JSON.stringify({ users: [] }, null, 2));
}

/* READ FUNCTION */
function read() {
  try {
    const data = fs.readFileSync(dbFile, "utf8");
    return data ? JSON.parse(data) : { users: [] };
  } catch (err) {
    return { users: [] };
  }
}

/* WRITE FUNCTION */
function write(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

/* ================= LOGIN ================= */

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const db = read();

  if (!db.users) db.users = [];

  const user = db.users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ msg: "Invalid login" });
  }

  res.json({ msg: "Login successful", user });
});

/* ================= REGISTER ================= */

app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  const db = read();

  if (!db.users) db.users = [];

  const exists = db.users.find(u => u.username === username);
  if (exists) {
    return res.status(400).json({ msg: "User already exists" });
  }

  const newUser = {
    id: Date.now(),
    username,
    password
  };

  db.users.push(newUser);
  write(db);

  res.json({ msg: "User registered", user: newUser });
});

/* ================= GENERIC CRUD ================= */

function crud(name) {
  app.get("/api/" + name, (req, res) => {
    const db = read();
    if (!db[name]) db[name] = [];
    res.json(db[name]);
  });

  app.post("/api/" + name, (req, res) => {
    const db = read();
    if (!db[name]) db[name] = [];

    const item = req.body;
    item.id = Date.now();

    db[name].push(item);
    write(db);

    res.json({ msg: "saved", data: item });
  });

  app.delete("/api/" + name + "/:id", (req, res) => {
    const db = read();
    const id = parseInt(req.params.id);

    if (!db[name]) db[name] = [];

    db[name] = db[name].filter(x => x.id !== id);
    write(db);

    res.json({ msg: "deleted" });
  });
}

/* MODULES */
[
  "students","teachers","attendance","marks","fees","timetable",
  "exams","onlineExams","homework",
  "employees","leaveRequests",
  "libraryBooks","transportRoutes","hostelRooms",
  "admission","visitors","calls","incomingMail","outgoingMail","complaints"
].forEach(crud);

/* ================= CHAT ================= */

app.get("/api/chat", (req, res) => {
  const db = read();
  res.json(db.chat || []);
});

app.post("/api/chat", (req, res) => {
  const db = read();
  if (!db.chat) db.chat = [];

  const msg = req.body;
  msg.id = Date.now();

  db.chat.push(msg);
  write(db);

  res.json({ msg: "sent" });
});

/* SOCKET */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const db = read();
  socket.emit("chat history", db.chat || []);

  socket.on("chat message", (msg) => {
    if (!msg.text) return;

    const db = read();
    if (!db.chat) db.chat = [];

    const message = {
      id: Date.now(),
      user: msg.user,
      text: msg.text
    };

    db.chat.push(message);
    write(db);

    io.emit("chat message", message);
  });
});

/* ================= MATERIAL UPLOAD ================= */

app.post("/api/materials", upload.single("file"), (req, res) => {
  const db = read();
  if (!db.materials) db.materials = [];

  const material = {
    id: Date.now(),
    title: req.body.title,
    subject: req.body.subject,
    file: req.file.filename
  };

  db.materials.push(material);
  write(db);

  res.json({ msg: "uploaded" });
});

app.get("/api/materials", (req, res) => {
  const db = read();
  res.json(db.materials || []);
});

app.delete("/api/materials/:id", (req, res) => {
  const db = read();
  const id = parseInt(req.params.id);

  const material = (db.materials || []).find(m => m.id === id);

  if (material) {
    const filePath = path.join(__dirname, "uploads", material.file);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.materials = (db.materials || []).filter(m => m.id !== id);
  write(db);

  res.json({ msg: "deleted" });
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});