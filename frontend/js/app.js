// Expense Tracker - frontend logic

const API_URL = "http://localhost:3000/api/expenses";

// Bootstrap color for each category badge
const CATEGORY_COLORS = {
  Food: "success",
  Transport: "primary",
  Bills: "danger",
  Entertainment: "warning",
  Other: "secondary"
};

// The key we use to remember the user's theme in the browser (only the theme, never expenses)
const THEME_KEY = "expense-tracker-theme";

// Elements we use a lot
const alertBox = document.getElementById("alertBox");
const spinner = document.getElementById("spinner");
const expensesBody = document.getElementById("expensesBody");
const totalAmountEl = document.getElementById("totalAmount");
const expenseCountEl = document.getElementById("expenseCount");
const highestAmountEl = document.getElementById("highestAmount");
const highestTitleEl = document.getElementById("highestTitle");
const categoryFilter = document.getElementById("categoryFilter");
const themeToggle = document.getElementById("themeToggle");

// The add form
const expenseForm = document.getElementById("expenseForm");
const addButton = document.getElementById("addButton");
const formFields = {
  title: document.getElementById("titleInput"),
  amount: document.getElementById("amountInput"),
  category: document.getElementById("categoryInput"),
  date: document.getElementById("dateInput")
};

// The edit modal
const editForm = document.getElementById("editForm");
const saveButton = document.getElementById("saveButton");
const editAlertBox = document.getElementById("editAlertBox");
const editModal = new bootstrap.Modal(document.getElementById("editModal"));
const editFields = {
  title: document.getElementById("editTitleInput"),
  amount: document.getElementById("editAmountInput"),
  category: document.getElementById("editCategoryInput"),
  date: document.getElementById("editDateInput")
};

// The full list from the server (the summary is always calculated from this)
let allExpenses = [];

// The id of the expense that is open in the edit modal
let editingId = null;

// ---------- Small UI helpers ----------

function showSpinner() {
  spinner.classList.remove("d-none");
}

function hideSpinner() {
  spinner.classList.add("d-none");
}

function clearAlerts() {
  alertBox.innerHTML = "";
}

// Show a Bootstrap alert that the user can close.
// By default it goes to the top of the page, but we can send it to another box (like the modal).
function showAlert(message, type = "danger", container = alertBox) {
  const alert = document.createElement("div");
  alert.className = "alert alert-" + type + " alert-dismissible fade show";
  alert.setAttribute("role", "alert");
  alert.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "btn-close";
  closeButton.setAttribute("data-bs-dismiss", "alert");
  closeButton.setAttribute("aria-label", "Close");

  alert.appendChild(closeButton);
  container.appendChild(alert);
}

// Turn any error into a message a normal user understands
function getErrorMessage(error) {
  // fetch throws a TypeError when it cannot reach the server at all
  if (error instanceof TypeError) {
    return "Can't reach the server. Make sure the backend is running, then refresh the page.";
  }
  return error.message;
}

// 4.5 -> "4.50"
function formatAmount(amount) {
  return amount.toFixed(2);
}

// Today's date in the user's own time zone, as "YYYY-MM-DD"
function todayText() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

// ---------- Talking to the API ----------

// Read the JSON body of a response. If there is no valid JSON, return an empty object.
async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

// GET all expenses
async function getExpenses() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error("Could not load the expenses (status " + response.status + ").");
  }

  return await response.json();
}

// POST a new expense
async function addExpense(expense) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expense)
  });

  const result = await readJson(response);

  // For a 400, the server explains the problem in result.message
  if (!response.ok) {
    throw new Error(result.message || "Could not add the expense (status " + response.status + ").");
  }

  return result;
}

// PUT (update) an expense by id
async function updateExpense(id, expense) {
  const response = await fetch(API_URL + "/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expense)
  });

  const result = await readJson(response);

  if (!response.ok) {
    throw new Error(result.message || "Could not update the expense (status " + response.status + ").");
  }

  return result;
}

// DELETE an expense by id
async function deleteExpense(id) {
  const response = await fetch(API_URL + "/" + id, { method: "DELETE" });

  const result = await readJson(response);

  if (!response.ok) {
    throw new Error(result.message || "Could not delete the expense (status " + response.status + ").");
  }

  return result;
}

// Get the list from the server, then draw the table and the summary
async function refresh() {
  showSpinner();
  clearAlerts();

  try {
    allExpenses = await getExpenses();
    applyFilter();                 // the table shows the filtered list
    renderSummary(allExpenses);    // the cards always use ALL expenses
  } catch (error) {
    showAlert(getErrorMessage(error));
  } finally {
    hideSpinner();
  }
}

// ---------- Drawing the page ----------

// Build one table row for every expense
function renderTable(list) {
  expensesBody.innerHTML = "";

  if (list.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "text-center text-muted py-4";
    cell.textContent = "No expenses to show.";
    row.appendChild(cell);
    expensesBody.appendChild(row);
    return;
  }

  list.forEach(function (expense) {
    const row = document.createElement("tr");

    const titleCell = document.createElement("td");
    titleCell.textContent = expense.title;

    // text-nowrap keeps the value on one line on small screens
    const amountCell = document.createElement("td");
    amountCell.className = "text-nowrap";
    amountCell.textContent = formatAmount(expense.amount);

    const categoryCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge text-bg-" + (CATEGORY_COLORS[expense.category] || "secondary");
    badge.textContent = expense.category;
    categoryCell.appendChild(badge);

    const dateCell = document.createElement("td");
    dateCell.className = "text-nowrap";
    dateCell.textContent = expense.date;

    const actionsCell = document.createElement("td");
    actionsCell.className = "text-end text-nowrap";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-sm btn-outline-primary me-2";
    editButton.textContent = "Edit";
    editButton.dataset.action = "edit";
    editButton.dataset.id = expense.id;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-sm btn-outline-danger";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = expense.id;

    actionsCell.appendChild(editButton);
    actionsCell.appendChild(deleteButton);

    row.appendChild(titleCell);
    row.appendChild(amountCell);
    row.appendChild(categoryCell);
    row.appendChild(dateCell);
    row.appendChild(actionsCell);

    expensesBody.appendChild(row);
  });
}

// Update the 3 summary cards
function renderSummary(list) {
  const total = list.reduce(function (sum, expense) {
    return sum + expense.amount;
  }, 0);

  totalAmountEl.textContent = formatAmount(total);
  expenseCountEl.textContent = list.length;

  if (list.length === 0) {
    highestAmountEl.textContent = formatAmount(0);
    highestTitleEl.textContent = "—";
    return;
  }

  const highest = list.reduce(function (max, expense) {
    return expense.amount > max.amount ? expense : max;
  });

  highestAmountEl.textContent = formatAmount(highest.amount);
  highestTitleEl.textContent = highest.title;
}

// ---------- Filter ----------

// The expenses that match the selected category ("All" = every expense)
function getFilteredList() {
  const selected = categoryFilter.value;

  if (selected === "All") {
    return allExpenses;
  }

  return allExpenses.filter(function (expense) {
    return expense.category === selected;
  });
}

// Redraw the table with the filtered list (no request to the server needed)
function applyFilter() {
  renderTable(getFilteredList());
}

categoryFilter.addEventListener("change", applyFilter);

// ---------- Shared form helpers (used by the add form AND the edit modal) ----------

// Read the 4 inputs of a form and return an expense object
function readForm(fields) {
  const amountText = fields.amount.value;

  return {
    title: fields.title.value.trim(),
    amount: amountText === "" ? NaN : Number(amountText),
    category: fields.category.value,
    date: fields.date.value
  };
}

// Check the data. Returns an object like { title: "message" } for every problem.
function validateForm(expense) {
  const errors = {};

  if (expense.title === "") {
    errors.title = "Title is required.";
  } else if (expense.title.length > 100) {
    errors.title = "Title must be 100 characters or less.";
  }

  if (isNaN(expense.amount)) {
    errors.amount = "Amount is required.";
  } else if (expense.amount < 0.01) {
    errors.amount = "Amount must be greater than 0.";
  }

  if (expense.category === "") {
    errors.category = "Choose a category.";
  }

  if (expense.date === "") {
    errors.date = "Date is required.";
  }

  return errors;
}

// Show every error in red under its input.
// The error box id is the input id with "Input" changed to "Error" (titleInput -> titleError).
function showFieldErrors(fields, errors) {
  for (const field in errors) {
    const input = fields[field];
    input.classList.add("is-invalid");
    document.getElementById(input.id.replace("Input", "Error")).textContent = errors[field];
  }
}

// Remove all the red errors from a form
function clearFieldErrors(fields) {
  for (const field in fields) {
    fields[field].classList.remove("is-invalid");
  }
}

// When the user types in any input (add form or modal), remove its red error
[formFields, editFields].forEach(function (fields) {
  for (const field in fields) {
    fields[field].addEventListener("input", function () {
      fields[field].classList.remove("is-invalid");
    });
  }
});

// ---------- Add ----------

// Empty the add form and put today's date back
function resetForm() {
  expenseForm.reset();
  clearFieldErrors(formFields);
  formFields.date.value = todayText();
}

expenseForm.addEventListener("submit", async function (event) {
  // Stop the browser from reloading the page
  event.preventDefault();

  clearAlerts();
  clearFieldErrors(formFields);

  const expense = readForm(formFields);
  const errors = validateForm(expense);

  // If there is any problem, show it and do NOT send anything to the server
  if (Object.keys(errors).length > 0) {
    showFieldErrors(formFields, errors);
    return;
  }

  // Disable the button so the user can't send the same expense twice
  addButton.disabled = true;
  showSpinner();

  try {
    await addExpense(expense);
    resetForm();
    // Ask the server for the list again, so the page shows what was really saved
    await refresh();
    showAlert("Expense added.", "success");
  } catch (error) {
    showAlert(getErrorMessage(error));
  } finally {
    addButton.disabled = false;
    hideSpinner();
  }
});

// ---------- Edit ----------

// Fill the modal with the current data of the expense, then open it
function openEditModal(id) {
  const expense = allExpenses.find(function (item) {
    return item.id === id;
  });

  if (!expense) {
    showAlert("This expense doesn't exist anymore. The list will be refreshed.");
    refresh();
    return;
  }

  editingId = id;

  editFields.title.value = expense.title;
  editFields.amount.value = expense.amount;
  editFields.category.value = expense.category;
  editFields.date.value = expense.date;

  clearFieldErrors(editFields);
  editAlertBox.innerHTML = "";

  editModal.show();
}

editForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  clearFieldErrors(editFields);
  editAlertBox.innerHTML = "";

  const expense = readForm(editFields);
  const errors = validateForm(expense);

  if (Object.keys(errors).length > 0) {
    showFieldErrors(editFields, errors);
    return;
  }

  saveButton.disabled = true;

  try {
    await updateExpense(editingId, expense);
    editModal.hide();
    await refresh();
    showAlert("Expense updated.", "success");
  } catch (error) {
    // Show the error inside the modal, where the user is looking
    showAlert(getErrorMessage(error), "danger", editAlertBox);
  } finally {
    saveButton.disabled = false;
  }
});

// ---------- Delete ----------

async function handleDelete(id) {
  const expense = allExpenses.find(function (item) {
    return item.id === id;
  });
  const name = expense ? expense.title : "this expense";

  // Ask the user first, so nothing is deleted by mistake
  if (!confirm('Delete "' + name + '"?')) {
    return;
  }

  clearAlerts();
  showSpinner();

  try {
    await deleteExpense(id);
    await refresh();
    showAlert("Expense deleted.", "success");
  } catch (error) {
    showAlert(getErrorMessage(error));
  } finally {
    hideSpinner();
  }
}

// ---------- Table buttons ----------

// One click listener for the whole table (the buttons are rebuilt on every refresh)
expensesBody.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const id = Number(button.dataset.id);

  if (button.dataset.action === "edit") {
    openEditModal(id);
  } else if (button.dataset.action === "delete") {
    handleDelete(id);
  }
});

// ---------- Dark mode (Bonus) ----------

// Put the theme on <html>. Bootstrap changes all its colors when data-bs-theme is "dark".
function applyTheme(theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode";
}

// Use the theme the user chose last time (light if there is none)
function loadTheme() {
  let savedTheme = null;

  // localStorage can be blocked by the browser, so we never let it break the page
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
  } catch (error) {
    savedTheme = null;
  }

  applyTheme(savedTheme === "dark" ? "dark" : "light");
}

// Switch between light and dark, and remember the choice
themeToggle.addEventListener("click", function () {
  const currentTheme = document.documentElement.getAttribute("data-bs-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  applyTheme(newTheme);

  try {
    localStorage.setItem(THEME_KEY, newTheme);
  } catch (error) {
    // If saving fails, the theme still works, it just won't be remembered
  }
});

// ---------- Start ----------

loadTheme();
formFields.date.value = todayText();
refresh();