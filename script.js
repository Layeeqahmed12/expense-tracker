const persistentStorage = {
  saveData(key, data) {
    try {
      let storage = {};
      if (window.name) {
        storage = JSON.parse(window.name);
      }
      storage[key] = data;
      window.name = JSON.stringify(storage);
    } catch (e) {
      console.error('Error saving data:', e);
    }
  },

  loadData(key) {
    try {
      if (window.name) {
        const storage = JSON.parse(window.name);
        return storage[key] || null;
      }
    } catch (e) {
      console.error('Error loading data:', e);
    }
    return null;
  },

  clearData() {
    window.name = '';
  }
};

const fakeDB = {
  users: [],
  expenses: {},
  
  init() {
    const savedUsers = persistentStorage.loadData('users');
    const savedExpenses = persistentStorage.loadData('expenses');
    
    if (savedUsers) {
      this.users = savedUsers;
    } else {
      this.users = [
        { username: 'admin', password: 'admin123', profileName: 'Admin User' }
      ];
      this.saveUsers();
    }
    
    if (savedExpenses) {
      this.expenses = savedExpenses;
    }
  },

  saveUsers() {
    persistentStorage.saveData('users', this.users);
  },

  saveExpenses() {
    persistentStorage.saveData('expenses', this.expenses);
  },

  addUser(username, password, profileName) {
    this.users.push({ username, password, profileName });
    this.saveUsers();
  },

  getUser(username) {
    return this.users.find(u => u.username === username);
  },

  addExpense(username, expense) {
    if (!this.expenses[username]) {
      this.expenses[username] = [];
    }
    expense.id = Date.now() + Math.random();
    this.expenses[username].unshift(expense);
    this.saveExpenses();
    return expense;
  },

  getExpenses(username) {
    return this.expenses[username] || [];
  },

  deleteExpense(username, id) {
    if (this.expenses[username]) {
      this.expenses[username] = this.expenses[username].filter(e => e.id !== id);
      this.saveExpenses();
      return true;
    }
    return false;
  }
};

let sessionData = {
  token: null,
  currentUser: null,
  profileName: null
};

function saveSession() {
  persistentStorage.saveData('session', sessionData);
}

function loadSession() {
  const saved = persistentStorage.loadData('session');
  if (saved && saved.token) {
    sessionData = saved;
    return true;
  }
  return false;
}

function clearSession() {
  sessionData = {
    token: null,
    currentUser: null,
    profileName: null
  };
  persistentStorage.saveData('session', sessionData);
}

class EmailService {
  constructor() {
    this.publicKey = 'kjWbSLN3PELL8SuPF';
    this.serviceId = 'service_o2x4nie';
    this.templateId = 'template_d6kfymh';
    this.initialized = false;
  }

  async init() {
    if (typeof emailjs === 'undefined') {
      throw new Error('EmailJS library not loaded');
    }
    
    if (this.publicKey === 'YOUR_PUBLIC_KEY') {
      throw new Error('EmailJS configuration not set');
    }
    
    emailjs.init(this.publicKey);
    this.initialized = true;
  }

  async sendOTP(email, profileName, otpCode) {
    if (!this.initialized) {
      await this.init();
    }

    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 15);
    const formattedTime = expiryTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const templateParams = {
      to_email: email,
      to_name: profileName,
      user_name: profileName,
      passcode: otpCode,
      otp_code: otpCode,
      time: formattedTime,
      company_name: 'Advanced Expense Tracker',
      from_name: 'Advanced Expense Tracker'
    };

    try {
      const response = await emailjs.send(
        this.serviceId,
        this.templateId,
        templateParams
      );
      
      return {
        success: true,
        message: `OTP sent successfully to ${email}`,
        expiryTime: formattedTime
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Failed to send email: ' + error.message);
    }
  }
}

const server = {
  login: (username, password) => {
    try {
      const user = fakeDB.getUser(username);
      if (user && user.password === password) {
        sessionData.token = 'mock-token-' + Date.now();
        sessionData.currentUser = username;
        sessionData.profileName = user.profileName;
        saveSession();
        return { success: true, token: sessionData.token };
      }
      return { success: false, message: 'Invalid credentials' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed' };
    }
  },

  register: (username, password, profileName) => {
    try {
      if (fakeDB.getUser(username)) {
        return { success: false, message: 'Username already exists' };
      }
      fakeDB.addUser(username, password, profileName);
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Registration failed' };
    }
  },

  getExpenses: () => {
    return fakeDB.getExpenses(sessionData.currentUser);
  },

  addExpense: (expense) => {
    return fakeDB.addExpense(sessionData.currentUser, expense);
  },

  deleteExpense: (id) => {
    const success = fakeDB.deleteExpense(sessionData.currentUser, id);
    return { success };
  }
};

function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('login.html')) return 'login';
  if (path.includes('register.html')) return 'register';
  return 'main';
}

function initLoginPage() {
  const loginForm = document.getElementById('login-form');
  
  if (!loginForm) {
    console.error('Login form not found');
    return;
  }
  
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
      alert('Please enter both username and password');
      return;
    }
    
    const result = server.login(username, password);
    
    if (result.success) {
      alert('Login successful!');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    } else {
      alert(result.message || 'Invalid username or password');
    }
  });
}

function initRegisterPage() {
  let generatedOTP = '';
  let otpExpiryTimer = null;
  const emailService = new EmailService();

  const sendOTPBtn = document.getElementById('send-otp-btn');
  const registerForm = document.getElementById('register-form');
  const otpSection = document.getElementById('otp-section');

  if (!sendOTPBtn || !registerForm || !otpSection) {
    console.error('Required elements not found on register page');
    return;
  }

  sendOTPBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const profileName = document.getElementById('profile-name').value.trim();

    if (!email || !profileName) {
      alert('Please enter both email and profile name');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    
    sendOTPBtn.disabled = true;
    sendOTPBtn.textContent = 'Sending OTP...';

    try {
      const result = await emailService.sendOTP(email, profileName, generatedOTP);
      
      alert(`OTP sent successfully to ${email}!\n\nPlease check your inbox and spam folder.\nOTP will expire at ${result.expiryTime}`);
      
      otpSection.style.display = 'block';
      sendOTPBtn.textContent = 'OTP Sent';
      sendOTPBtn.style.background = '#28a745';

      if (otpExpiryTimer) {
        clearTimeout(otpExpiryTimer);
      }

      otpExpiryTimer = setTimeout(() => {
        generatedOTP = '';
        alert('OTP has expired. Please request a new one.');
        otpSection.style.display = 'none';
        sendOTPBtn.disabled = false;
        sendOTPBtn.textContent = 'Send OTP';
        sendOTPBtn.style.background = '#007bff';
      }, 15 * 60 * 1000);

      setTimeout(() => {
        sendOTPBtn.disabled = false;
        sendOTPBtn.textContent = 'Resend OTP';
        sendOTPBtn.style.background = '#ffc107';
      }, 30000);

    } catch (error) {
      console.error('Email sending error:', error);
      
      sendOTPBtn.disabled = false;
      sendOTPBtn.textContent = 'Send OTP';
      sendOTPBtn.style.background = '#007bff';
      
      if (error.message.includes('EmailJS configuration')) {
        alert('Email service not configured. Please contact administrator.');
      } else if (error.message.includes('EmailJS library')) {
        alert('Email service unavailable. Please try again later.');
      } else {
        alert('Failed to send OTP. Please try again.');
      }
    }
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value.trim();
    const profileName = document.getElementById('profile-name').value.trim();
    const enteredOTP = document.getElementById('otp-input').value.trim();

    if (!username || !password || !profileName) {
      alert('Please fill in all fields');
      return;
    }

    if (username.length < 3) {
      alert('Username must be at least 3 characters long');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    if (!generatedOTP) {
      alert('Please send OTP first or the OTP has expired');
      return;
    }

    if (enteredOTP !== generatedOTP) {
      alert('Invalid OTP. Please check and try again.');
      return;
    }

    const result = server.register(username, password, profileName);
    
    if (result.success) {
      alert('Registration successful! You can now log in.');
      
      generatedOTP = '';
      if (otpExpiryTimer) {
        clearTimeout(otpExpiryTimer);
      }
      
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1000);
    } else {
      alert(`Registration failed: ${result.message}`);
    }
  });
}

class ExpenseTracker {
  constructor() {
    loadSession();
    
    if (!sessionData.token) {
      alert('Please log in to access the expense tracker');
      window.location.href = 'login.html';
      return;
    }

    this.expenses = server.getExpenses();
    this.currentFilter = { category: 'all', period: 'all', search: '' };
    
    this.initializeEventListeners();
    this.setDefaultDate();
    this.renderExpenses();
    this.updateStats();
    this.updateChart();
  }

  initializeEventListeners() {
    const expenseForm = document.getElementById('expense-form');
    if (expenseForm) {
      expenseForm.addEventListener('submit', (e) => {
        this.handleSubmit(e);
      });
    }

    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e);
      });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.handleFilter(e);
      });
    });
  }

  setDefaultDate() {
    const dateInput = document.getElementById('date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }
  }

  handleSubmit(e) {
    e.preventDefault();
    
    const description = document.getElementById('description').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;

    if (!description || isNaN(amount) || amount <= 0 || !category || !date) {
      alert('Please fill in all fields with valid values');
      return;
    }

    const expense = {
      description,
      amount,
      category,
      date: new Date(date),
      timestamp: new Date()
    };

    const newExpense = server.addExpense(expense);
    this.expenses = server.getExpenses();
    
    this.renderExpenses();
    this.updateStats();
    this.updateChart();
    this.clearForm();
    
    alert('Expense added successfully!');
  }

  handleSearch(e) {
    this.currentFilter.search = e.target.value.toLowerCase();
    this.renderExpenses();
  }

  handleFilter(e) {
    const btn = e.target;
    const category = btn.dataset.category;
    const period = btn.dataset.period;

    btn.parentElement.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.remove('active');
    });
    
    btn.classList.add('active');

    if (category) {
      this.currentFilter.category = category;
    } else if (period) {
      this.currentFilter.period = period;
    }

    this.renderExpenses();
    this.updateStats();
  }

  clearForm() {
    const form = document.getElementById('expense-form');
    if (form) {
      form.reset();
      this.setDefaultDate();
    }
  }

  deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
      const result = server.deleteExpense(id);
      if (result.success) {
        this.expenses = server.getExpenses();
        this.renderExpenses();
        this.updateStats();
        this.updateChart();
      }
    }
  }

  filterExpenses() {
    let filtered = this.expenses;

    if (this.currentFilter.category !== 'all') {
      filtered = filtered.filter(e => e.category === this.currentFilter.category);
    }

    if (this.currentFilter.period !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(exp => {
        const expDate = new Date(exp.date);
        
        switch (this.currentFilter.period) {
          case 'today':
            return expDate >= today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return expDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return expDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    if (this.currentFilter.search) {
      filtered = filtered.filter(e => 
        e.description.toLowerCase().includes(this.currentFilter.search)
      );
    }

    return filtered;
  }

  renderExpenses() {
    const list = document.getElementById('expense-list');
    if (!list) return;
    
    const expenses = this.filterExpenses();
    
    if (expenses.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>No expenses found</h3>
          <p>Add your first expense or adjust your filters</p>
        </div>
      `;
      return;
    }

    list.innerHTML = expenses.map(exp => `
      <div class="expense-item category-${exp.category}">
        <div class="expense-details">
          <div class="expense-description">${exp.description}</div>
          <div class="expense-meta">
            ${this.getCategoryIcon(exp.category)} ${this.formatCategory(exp.category)} • ${this.formatDate(exp.date)}
          </div>
        </div>
        <div class="expense-amount">₹${exp.amount.toFixed(2)}</div>
        <div class="expense-actions">
          <button class="delete-btn" onclick="window.tracker.deleteExpense(${exp.id})" title="Delete expense">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  }

  updateStats() {
    const expenses = this.filterExpenses();
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const count = expenses.length;
    const average = count > 0 ? total / count : 0;

    const totalElement = document.getElementById('total-amount');
    const countElement = document.getElementById('total-count');
    const avgElement = document.getElementById('avg-amount');

    if (totalElement) totalElement.textContent = total.toFixed(2);
    if (countElement) countElement.textContent = count;
    if (avgElement) avgElement.textContent = average.toFixed(2);
  }

  updateChart() {
    const chart = document.getElementById('category-chart');
    if (!chart) return;
    
    const categories = ['food', 'transport', 'entertainment', 'utilities', 'healthcare', 'other'];
    const totals = categories.map(cat => {
      return this.expenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
    });
    
    const maxTotal = Math.max(...totals);
    
    chart.innerHTML = categories.map((cat, i) => `
      <div class="category-bar">
        <div class="bar-label">${this.formatCategory(cat)}</div>
        <div class="bar" style="height: ${maxTotal > 0 ? (totals[i] / maxTotal * 150) : 5}px"></div>
        <div class="bar-value">₹${totals[i].toFixed(0)}</div>
      </div>
    `).join('');
  }

  formatCategory(category) {
    const names = {
      food: 'Food & Dining',
      transport: 'Transportation',
      entertainment: 'Entertainment',
      utilities: 'Utilities',
      healthcare: 'Healthcare',
      other: 'Other'
    };
    return names[category] || 'Other';
  }

  getCategoryIcon(category) {
    const icons = {
      food: '🍔',
      transport: '🚗',
      entertainment: '🎮',
      utilities: '💡',
      healthcare: '⚕️',
      other: '📦'
    };
    return icons[category] || '📦';
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  exportToCSV() {
    const expenses = this.filterExpenses();
    
    if (expenses.length === 0) {
      alert('No expenses to export!');
      return;
    }

    const headers = ['Date', 'Description', 'Category', 'Amount'];
    const csvContent = [
      headers.join(','),
      ...expenses.map(exp => [
        this.formatDate(exp.date),
        `"${exp.description}"`,
        this.formatCategory(exp.category),
        exp.amount.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  refreshData() {
    this.expenses = server.getExpenses();
    this.renderExpenses();
    this.updateStats();
    this.updateChart();
  }
}

function createUtilityButtons() {
  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Logout';
  logoutBtn.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 8px 16px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    z-index: 1000;
    font-size: 14px;
  `;
  logoutBtn.onclick = () => {
    if (confirm('Are you sure you want to logout?')) {
      clearSession();
      window.location.href = 'login.html';
    }
  };
  document.body.appendChild(logoutBtn);

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export CSV';
  exportBtn.style.cssText = `
    position: fixed;
    top: 10px;
    right: 90px;
    padding: 8px 16px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    z-index: 1000;
    font-size: 14px;
  `;
  exportBtn.onclick = () => {
    if (window.tracker) {
      window.tracker.exportToCSV();
    }
  };
  document.body.appendChild(exportBtn);

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear All Data';
  clearBtn.style.cssText = `
    position: fixed;
    top: 10px;
    right: 190px;
    padding: 8px 16px;
    background: #ffc107;
    color: black;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    z-index: 1000;
    font-size: 14px;
  `;
  clearBtn.onclick = () => {
    if (confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
      persistentStorage.clearData();
      alert('All data cleared! You will be redirected to login.');
      window.location.href = 'login.html';
    }
  };
  document.body.appendChild(clearBtn);
}

function showWelcomeMessage() {
  const header = document.querySelector('.header h1');
  if (header && sessionData.profileName) {
    const welcomeMsg = document.createElement('p');
    welcomeMsg.textContent = `Welcome back, ${sessionData.profileName}!`;
    welcomeMsg.style.cssText = `
      margin-top: 10px;
      font-size: 1.1rem;
      opacity: 0.9;
      font-weight: normal;
    `;
    header.appendChild(welcomeMsg);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fakeDB.init();
  
  const currentPage = getCurrentPage();
  loadSession();
  
  switch (currentPage) {
    case 'login':
      if (sessionData.token) {
        window.location.href = 'index.html';
        return;
      }
      initLoginPage();
      break;
      
    case 'register':
      if (sessionData.token) {
        window.location.href = 'index.html';
        return;
      }
      initRegisterPage();
      break;
      
    case 'main':
      if (!sessionData.token) {
        alert('Please log in to access the expense tracker');
        window.location.href = 'login.html';
        return;
      }
      
      createUtilityButtons();
      window.tracker = new ExpenseTracker();
      showWelcomeMessage();
      break;
      
    default:
      console.warn('Unknown page type');
  }
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('beforeunload', (event) => {
  const currentPage = getCurrentPage();
  if (currentPage === 'main' && !sessionData.token) {
    event.preventDefault();
    event.returnValue = '';
  }
});

window.checkStoredData = function() {
  console.log('=== STORED DATA DEBUG ===');
  console.log('window.name:', window.name);
  console.log('Session data:', sessionData);
  console.log('Users:', fakeDB.users);
  console.log('Expenses:', fakeDB.expenses);
  console.log('========================');
};
