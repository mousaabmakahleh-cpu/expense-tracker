// Expense Tracker - backend (Express API + PostgreSQL)

// Load the values from .env into process.env (must be the first line)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = 3000;

// The largest value a PostgreSQL INTEGER (and SERIAL) column can hold
const MAX_INT = 2147483647;

// The only categories the app accepts (same list as the CHECK in schema.sql)
const CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Other"];

// The largest amount a NUMERIC(10,2) column can hold
const MAX_AMOUNT = 99999999.99;

// The columns we send back for an expense.
// pg returns NUMERIC as text and DATE as a JS Date, so we fix both here:
// amount becomes a real number, and date becomes plain "YYYY-MM-DD" text.
// This is fixed text written by us, never data from the user.
const EXPENSE_COLUMNS =
  "id, title, amount::float8 AS amount, category, to_char(date, 'YYYY-MM-DD') AS date";

app.use(cors());

// Read JSON bodies (POST and PUT) and put them in req.body
app.use(express.json());

// One Pool for the whole app: it keeps a few connections open and reuses them
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Returns true only for a whole positive number that fits in an INTEGER column
function isValidId(id) {
  return Number.isInteger(id) && id > 0 && id <= MAX_INT;
}

// Returns true only for a real date written as "YYYY-MM-DD" (so "2026-02-30" fails)
function isValidDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const date = new Date(text + "T00:00:00Z");
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// Checks the data of an expense. Returns an error message, or null if everything is fine.
function validateExpense(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Send the expense as a JSON object";
  }

  const { title, amount, category, date } = body;

  if (typeof title !== "string" || title.trim() === "") {
    return "Title is required";
  }
  if (title.trim().length > 100) {
    return "Title must be 100 characters or less";
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0.01) {
    return "Amount must be a number greater than 0";
  }
  if (amount > MAX_AMOUNT) {
    return "Amount is too large";
  }
  if (!CATEGORIES.includes(category)) {
    return "Category must be one of: " + CATEGORIES.join(", ");
  }
  if (!isValidDate(date)) {
    return "Date must be a real date in the format YYYY-MM-DD";
  }

  return null;
}

// GET /api/expenses -> all expenses
app.get("/api/expenses", async function (req, res) {
  try {
    const result = await pool.query(
      "SELECT " + EXPENSE_COLUMNS + " FROM expenses ORDER BY id"
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// GET /api/expenses/:id -> one expense
app.get("/api/expenses/:id", async function (req, res) {
  const id = Number(req.params.id);

  // Check the id BEFORE the query: "abc", "1.5", "-3" never reach the database
  if (!isValidId(id)) {
    return res.status(404).json({ message: "Expense not found" });
  }

  try {
    const result = await pool.query(
      "SELECT " + EXPENSE_COLUMNS + " FROM expenses WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// POST /api/expenses -> add a new expense
app.post("/api/expenses", async function (req, res) {
  // Validate BEFORE the query, and explain the problem with a 400
  const errorMessage = validateExpense(req.body);
  if (errorMessage) {
    return res.status(400).json({ message: errorMessage });
  }

  const { title, amount, category, date } = req.body;

  try {
    // The database creates the id. RETURNING sends the new row back to us.
    const result = await pool.query(
      "INSERT INTO expenses (title, amount, category, date) VALUES ($1, $2, $3, $4) RETURNING " +
        EXPENSE_COLUMNS,
      [title.trim(), amount, category, date]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// PUT /api/expenses/:id -> update an expense (all fields are sent again)
app.put("/api/expenses/:id", async function (req, res) {
  const id = Number(req.params.id);

  if (!isValidId(id)) {
    return res.status(404).json({ message: "Expense not found" });
  }

  const errorMessage = validateExpense(req.body);
  if (errorMessage) {
    return res.status(400).json({ message: errorMessage });
  }

  const { title, amount, category, date } = req.body;

  try {
    const result = await pool.query(
      "UPDATE expenses SET title = $1, amount = $2, category = $3, date = $4 WHERE id = $5 RETURNING " +
        EXPENSE_COLUMNS,
      [title.trim(), amount, category, date, id]
    );

    // No row was updated, so there is no expense with this id
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// DELETE /api/expenses/:id -> delete an expense
app.delete("/api/expenses/:id", async function (req, res) {
  const id = Number(req.params.id);

  if (!isValidId(id)) {
    return res.status(404).json({ message: "Expense not found" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM expenses WHERE id = $1 RETURNING " + EXPENSE_COLUMNS,
      [id]
    );

    // No row was deleted, so there is no expense with this id
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json({ message: "Expense deleted", expense: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// Any other path: answer 404 with JSON (not Express's default HTML page)
app.use(function (req, res) {
  res.status(404).json({ message: "Route not found" });
});

// If the request body is broken JSON, answer 400 with JSON (not an HTML error page)
app.use(function (error, req, res, next) {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "The request body is not valid JSON" });
  }
  console.error(error.message);
  res.status(500).json({ message: "Something went wrong on the server" });
});

// Start the server. In Express 5, a startup error (like a busy port) comes to this callback.
app.listen(PORT, function (error) {
  if (error) {
    console.error("Could not start the server: " + error.message);
    return;
  }
  console.log("Server is running on http://localhost:" + PORT);
});