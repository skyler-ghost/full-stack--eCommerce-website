/* Shared frontend logic: talks to the Express API. Loaded on every page. */
(function () {
  "use strict";

  /* ---------- helpers ---------- */
  const TOKEN_KEY = "token";
  const USER_KEY = "user";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let CONFIG = { currency: "₦", demoPayments: false };
  const money = (n) => CONFIG.currency + Number(n || 0).toLocaleString("en-NG");
  const token = () => localStorage.getItem(TOKEN_KEY);
  const user = () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (e) {
      return null;
    }
  };
  const setAuth = (t, u) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  };
  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };
  const currentPage = () =>
    (location.pathname.split("/").pop() || "index.html") + location.search;

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch("/api" + path, {
      method: opts.method || "GET",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        token() ? { Authorization: "Bearer " + token() } : {},
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      /* non-JSON */
    }
    if (!res.ok) {
      if (res.status === 401 && token()) clearAuth(); // expired or invalid token
      const err = new Error(data.message || "Something went wrong");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function toast(msg, type) {
    let box = $("#toast-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast-box";
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  function requireLogin() {
    if (token() && user()) return true;
    location.href = "login.html?next=" + encodeURIComponent(currentPage());
    return false;
  }
  function safeNext() {
    const n = new URLSearchParams(location.search).get("next") || "";
    return /^[a-z0-9_-]+\.html(\?[a-zA-Z0-9=&_.%-]*)?$/i.test(n)
      ? n
      : "index.html";
  }

  /* ---------- header / footer ---------- */
  function updateBadge(count) {
    $$(".cart-count").forEach((b) => {
      b.textContent = count;
      b.hidden = !count;
    });
  }
  function initChrome() {
    const nav = $("#navbar");
    const u = user();
    if (nav) {
      const bag = $("#lg-bag");
      const links = u
        ? '<li class="auth-li"><a href="orders.html">My Orders</a></li>' +
          (u.role === "admin"
            ? '<li class="auth-li"><a href="admin.html">Admin</a></li>'
            : "") +
          '<li class="auth-li"><a href="#" data-logout>Logout (' +
          esc((u.name || "").split(" ")[0]) +
          ")</a></li>"
        : '<li class="auth-li"><a href="login.html">Login</a></li>';
      if (bag) bag.insertAdjacentHTML("beforebegin", links);
      const page = location.pathname.split("/").pop();
      $$("#navbar .auth-li a").forEach((a) => {
        if (a.getAttribute("href") === page) a.classList.add("active");
      });
    }
    $$('#lg-bag a, #mobile a[href="cart.html"]').forEach((a) => {
      a.style.position = "relative";
      a.insertAdjacentHTML(
        "beforeend",
        '<span class="cart-count" hidden>0</span>',
      );
    });
    $$("footer a").forEach((a) => {
      const t = a.textContent.trim();
      if (t === "Sign In") {
        a.href = u ? "orders.html" : "login.html";
        a.textContent = u ? "My Orders" : "Sign In";
      } else if (t === "View Cart") a.href = "cart.html";
      else if (t === "Track My Order") a.href = "orders.html";
      else if (t === "About Us") a.href = "about.html";
      else if (t === "Contact Us") a.href = "contact.html";
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-logout]")) {
        e.preventDefault();
        clearAuth();
        location.href = "index.html";
      }
    });
    if (token())
      api("/cart")
        .then((c) => updateBadge(c.count))
        .catch(() => {});
    const nl = $("#newsletter");
    if (nl) {
      const input = $("input", nl),
        btn = $("button", nl);
      btn.addEventListener("click", async () => {
        const email = input.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          toast("Please enter a valid email address", "err");
          return;
        }
        btn.disabled = true;
        try {
          await api("/contact", {
            method: "POST",
            body: {
              name: "Newsletter subscriber",
              email,
              subject: "Newsletter signup",
              message: "Please add me to the newsletter.",
            },
          });
          toast("Thanks for subscribing!", "ok");
          input.value = "";
        } catch (e) {
          toast(e.message, "err");
        }
        btn.disabled = false;
      });
    }
  }

  /* ---------- product cards ---------- */
  const STARS =
    '<div class="star">' + '<i class="fas fa-star"></i>'.repeat(5) + "</div>";
  function card(p) {
    const out = p.stock <= 0;
    return (
      '<div class="pro" data-id="' +
      p._id +
      '">' +
      '<img src="' +
      esc(p.images[0] || "") +
      '" alt="' +
      esc(p.name) +
      '">' +
      '<div class="des"><span>' +
      esc(p.brand) +
      "</span><h5>" +
      esc(p.name) +
      "</h5>" +
      STARS +
      "<h4>" +
      money(p.price) +
      "</h4>" +
      (out ? '<small class="oos">Out of stock</small>' : "") +
      "</div>" +
      (out
        ? ""
        : '<a href="#" data-add="' +
          p._id +
          '" data-sizes="' +
          (p.sizes && p.sizes.length ? 1 : 0) +
          '" aria-label="Add to cart"><i class="fa-solid fa-cart-shopping cart"></i></a>') +
      "</div>"
    );
  }

  async function addToCart(productId, qty, size) {
    if (!token()) {
      toast("Please log in or create an account to add items to your cart");
      setTimeout(requireLogin, 1100);
      return false;
    }
    try {
      const cart = await api("/cart", {
        method: "POST",
        body: { productId, qty, size: size || "" },
      });
      updateBadge(cart.count);
      toast("Added to cart", "ok");
      return true;
    } catch (e) {
      toast(e.message, "err");
      return false;
    }
  }

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      e.preventDefault();
      e.stopPropagation();
      if (add.dataset.sizes === "1") {
        location.href = "sproduct.html?id=" + add.dataset.add;
        return;
      } // pick a size first
      addToCart(add.dataset.add, 1, "");
      return;
    }
    const pro = e.target.closest(".pro[data-id]");
    if (pro) location.href = "sproduct.html?id=" + pro.dataset.id;
  });

  /* ---------- home + shop listing ---------- */
  async function initListings() {
    for (const el of $$("[data-products]")) {
      const mode = el.dataset.products;
      const qs =
        mode === "new" ? "?new=true&limit=8" : "?featured=true&limit=8";
      try {
        const d = await api("/products" + qs);
        el.innerHTML = d.items.length
          ? d.items.map(card).join("")
          : "<p>No products yet.</p>";
      } catch (e) {
        el.innerHTML = "<p>Could not load products.</p>";
      }
    }
    const grid = $("#shop-grid");
    if (!grid) return;
    const state = { page: 1, q: "", sort: "newest" };
    const pag = $("#shop-pagination");
    async function load() {
      grid.innerHTML = "<p>Loading…</p>";
      try {
        const qs =
          "?limit=12&page=" +
          state.page +
          "&sort=" +
          state.sort +
          (state.q ? "&q=" + encodeURIComponent(state.q) : "");
        const d = await api("/products" + qs);
        grid.innerHTML = d.items.length
          ? d.items.map(card).join("")
          : "<p>No products match your search.</p>";
        let h = "";
        for (let i = 1; i <= d.pages; i++)
          h +=
            '<a href="#" data-page="' +
            i +
            '" class="' +
            (i === d.page ? "active-page" : "") +
            '">' +
            i +
            "</a>";
        pag.innerHTML = d.pages > 1 ? h : "";
      } catch (e) {
        grid.innerHTML = "<p>Could not load products.</p>";
      }
    }
    pag.addEventListener("click", (e) => {
      const a = e.target.closest("[data-page]");
      if (!a) return;
      e.preventDefault();
      state.page = Number(a.dataset.page);
      load();
      window.scrollTo({ top: 200, behavior: "smooth" });
    });
    let timer;
    $("#shop-q").addEventListener("input", (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.q = ev.target.value.trim();
        state.page = 1;
        load();
      }, 300);
    });
    $("#shop-sort").addEventListener("change", (ev) => {
      state.sort = ev.target.value;
      state.page = 1;
      load();
    });
    load();
  }

  /* ---------- single product ---------- */
  async function initProduct() {
    const main = $("#MainImg");
    if (!main) return;
    const id = new URLSearchParams(location.search).get("id");
    const details = $(".single-pro-details");
    if (!id) {
      details.innerHTML = "<h4>Product not found</h4>";
      return;
    }
    let p;
    try {
      p = await api("/products/" + encodeURIComponent(id));
    } catch (e) {
      details.innerHTML =
        '<h4>Product not found</h4><p><a href="shop.html">Back to shop</a></p>';
      return;
    }
    document.title = p.name;
    main.src = p.images[0] || "";
    $("#gallery").innerHTML = p.images
      .map(
        (src) =>
          '<div class="small-img-col"><img src="' +
          esc(src) +
          '" width="100%" class="small-img" alt=""></div>',
      )
      .join("");
    $("#gallery").addEventListener("click", (e) => {
      if (e.target.classList.contains("small-img")) main.src = e.target.src;
    });
    $("#p-crumb").textContent = "Home / " + (p.category || "Shop");
    $("#p-name").textContent = p.name;
    $("#p-price").textContent = money(p.price);
    $("#p-desc").textContent = p.description || "";
    const sel = $("#p-size");
    if (p.sizes && p.sizes.length)
      sel.innerHTML =
        '<option value="">Select Size</option>' +
        p.sizes.map((s) => "<option>" + esc(s) + "</option>").join("");
    else sel.style.display = "none";
    const qty = $("#p-qty"),
      btn = $("#p-add");
    if (p.stock <= 0) {
      btn.disabled = true;
      btn.textContent = "Out of stock";
    } else qty.max = p.stock;
    btn.addEventListener("click", async () => {
      if (p.sizes && p.sizes.length && !sel.value) {
        toast("Please select a size", "err");
        return;
      }
      btn.disabled = true;
      await addToCart(p._id, Math.max(1, parseInt(qty.value) || 1), sel.value);
      btn.disabled = false;
    });
    try {
      const rel = await api("/products?limit=5");
      $("#related-grid").innerHTML = rel.items
        .filter((x) => x._id !== p._id)
        .slice(0, 4)
        .map(card)
        .join("");
    } catch (e) {
      /* related is optional */
    }
  }

  /* ---------- cart ---------- */
  async function initCart() {
    const body = $("#cart-body");
    if (!body) return;
    if (!requireLogin()) return;
    async function load() {
      let cart;
      try {
        cart = await api("/cart");
      } catch (e) {
        if (e.status === 401) return requireLogin();
        toast(e.message, "err");
        return;
      }
      updateBadge(cart.count);
      if (!cart.items.length) {
        body.innerHTML =
          '<tr><td colspan="6" class="empty-cell">Your cart is empty. <a href="shop.html">Continue shopping</a></td></tr>';
      } else {
        body.innerHTML = cart.items
          .map(
            (i) =>
              '<tr data-line="' +
              i.lineId +
              '">' +
              '<td><a href="#" data-remove aria-label="Remove"><i class="far fa-times-circle"></i></a></td>' +
              '<td><img src="' +
              esc(i.product.images[0] || "") +
              '" alt=""></td>' +
              "<td>" +
              esc(i.product.name) +
              (i.size ? "<br><small>Size: " + esc(i.size) + "</small>" : "") +
              "</td>" +
              "<td>" +
              money(i.product.price) +
              "</td>" +
              '<td><input type="number" min="1" max="' +
              i.product.stock +
              '" value="' +
              i.qty +
              '" data-qty></td>' +
              "<td>" +
              money(i.lineTotal) +
              "</td></tr>",
          )
          .join("");
      }
      $("#cart-subtotal").textContent = money(cart.total);
      $("#cart-total").textContent = money(cart.total);
      $("#go-checkout").disabled = !cart.items.length;
    }
    body.addEventListener("click", async (e) => {
      const rm = e.target.closest("[data-remove]");
      if (!rm) return;
      e.preventDefault();
      try {
        await api("/cart/" + rm.closest("tr").dataset.line, {
          method: "DELETE",
        });
        load();
      } catch (err) {
        toast(err.message, "err");
      }
    });
    body.addEventListener("change", async (e) => {
      if (!e.target.matches("[data-qty]")) return;
      try {
        await api("/cart/" + e.target.closest("tr").dataset.line, {
          method: "PUT",
          body: { qty: e.target.value },
        });
      } catch (err) {
        toast(err.message, "err");
      }
      load();
    });
    $("#go-checkout").addEventListener("click", () => {
      location.href = "checkout.html";
    });
    load();
  }

  /* ---------- auth pages ---------- */
  function initAuth() {
    const login = $("#login-form"),
      reg = $("#register-form");
    const form = login || reg;
    if (!form) return;
    if (token() && user()) {
      location.href = safeNext();
      return;
    }
    const next = new URLSearchParams(location.search).get("next");
    if (next)
      $$(".auth-switch a").forEach((a) => {
        a.href += "?next=" + encodeURIComponent(next);
      });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true;
      const msg = $("#auth-msg");
      msg.textContent = "";
      const f = Object.fromEntries(new FormData(form).entries());
      try {
        if (reg && f.password !== f.confirm)
          throw new Error("Passwords do not match");
        const d = await api(login ? "/auth/login" : "/auth/register", {
          method: "POST",
          body: f,
        });
        setAuth(d.token, d.user);
        location.href = safeNext();
      } catch (err) {
        msg.textContent = err.message;
        btn.disabled = false;
      }
    });
  }

  /* ---------- checkout ---------- */
  async function initCheckout() {
    const form = $("#checkout-form");
    if (!form) return;
    if (!requireLogin()) return;
    let cart;
    try {
      cart = await api("/cart");
    } catch (e) {
      if (e.status === 401) return requireLogin();
    }
    if (!cart || !cart.items.length) {
      location.href = "cart.html";
      return;
    }
    $("#co-items").innerHTML = cart.items
      .map(
        (i) =>
          "<li><span>" +
          esc(i.product.name) +
          (i.size ? " (" + esc(i.size) + ")" : "") +
          " × " +
          i.qty +
          "</span><b>" +
          money(i.lineTotal) +
          "</b></li>",
      )
      .join("");
    $("#co-total").textContent = money(cart.total);
    const u = user();
    form.fullName.value = u.name || "";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#pay-btn"),
        msg = $("#co-msg");
      btn.disabled = true;
      msg.textContent = "";
      const f = Object.fromEntries(new FormData(form).entries());
      try {
        const order = await api("/orders", {
          method: "POST",
          body: { shippingAddress: f },
        });
        const pay = await api("/payment/initialize", {
          method: "POST",
          body: { orderId: order._id },
        });
        location.href = pay.authorization_url;
      } catch (err) {
        msg.textContent = err.message;
        btn.disabled = false;
      }
    });
  }

  /* ---------- orders + payment result ---------- */
  const badge = (s) => '<span class="status ' + s + '">' + s + "</span>";
  async function payOrder(orderId, btn) {
    btn.disabled = true;
    try {
      const pay = await api("/payment/initialize", {
        method: "POST",
        body: { orderId },
      });
      location.href = pay.authorization_url;
    } catch (e) {
      toast(e.message, "err");
      btn.disabled = false;
    }
  }
  async function initOrders() {
    const list = $("#orders-list");
    if (!list) return;
    if (!requireLogin()) return;
    try {
      const orders = await api("/orders/mine");
      list.innerHTML = orders.length
        ? orders
            .map(
              (o) =>
                '<div class="order-card"><div class="order-head"><div><b>Order #' +
                o._id.slice(-6).toUpperCase() +
                "</b><br><small>" +
                new Date(o.createdAt).toLocaleDateString() +
                "</small></div>" +
                badge(o.status) +
                "</div>" +
                "<ul>" +
                o.items
                  .map(
                    (i) =>
                      "<li>" +
                      esc(i.name) +
                      (i.size ? " (" + esc(i.size) + ")" : "") +
                      " × " +
                      i.qty +
                      "</li>",
                  )
                  .join("") +
                "</ul>" +
                '<div class="order-foot"><b>' +
                money(o.total) +
                "</b>" +
                (o.status === "pending"
                  ? '<button class="normal pay-now" data-pay="' +
                    o._id +
                    '">Pay now</button>'
                  : "") +
                "</div></div>",
            )
            .join("")
        : '<p>You have no orders yet. <a href="shop.html">Start shopping</a></p>';
      list.addEventListener("click", (e) => {
        const b = e.target.closest("[data-pay]");
        if (b) payOrder(b.dataset.pay, b);
      });
    } catch (e) {
      list.innerHTML = "<p>" + esc(e.message) + "</p>";
    }
  }

  async function initSuccess() {
    const box = $("#order-result");
    if (!box) return;
    if (!requireLogin()) return;
    const q = new URLSearchParams(location.search);
    const ref = q.get("reference") || q.get("trxref");
    if (!ref) {
      box.innerHTML =
        '<h3>No payment reference found</h3><p><a href="orders.html">View my orders</a></p>';
      return;
    }
    async function check(tries) {
      try {
        const r = await api("/payment/verify/" + encodeURIComponent(ref));
        if (
          r.status === "paid" ||
          r.status === "shipped" ||
          r.status === "delivered"
        ) {
          updateBadge(0);
          box.innerHTML =
            '<i class="fa-solid fa-circle-check big ok"></i><h3>Payment received. Thank you!</h3><p>We have emailed you a confirmation.</p><a class="btn-link" href="orders.html">View my orders</a>';
        } else if (q.get("demo") === "1" && CONFIG.demoPayments) {
          box.innerHTML =
            '<h3>Demo payment</h3><p>No Paystack key is set, so payments are simulated in development.</p><button class="normal" id="demo-pay">Simulate successful payment</button>';
          $("#demo-pay").addEventListener("click", async () => {
            try {
              await api("/payment/demo-confirm", {
                method: "POST",
                body: { reference: ref },
              });
              check(0);
            } catch (e) {
              toast(e.message, "err");
            }
          });
        } else if (tries < 5) {
          box.innerHTML = "<h3>Confirming your payment…</h3>";
          setTimeout(() => check(tries + 1), 2500);
        } else {
          box.innerHTML =
            '<h3>We could not confirm the payment yet</h3><p>If you were charged it will update shortly. Check <a href="orders.html">your orders</a>.</p>';
        }
      } catch (e) {
        box.innerHTML =
          "<h3>" +
          esc(e.message) +
          '</h3><p><a href="orders.html">View my orders</a></p>';
      }
    }
    check(0);
  }

  /* ---------- contact ---------- */
  function initContact() {
    const form = $("#contact-form");
    if (!form) return;
    const u = user();
    if (u) {
      form.elements.name.value = u.name || "";
      form.elements.email.value = u.email || "";
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        await api("/contact", {
          method: "POST",
          body: Object.fromEntries(new FormData(form).entries()),
        });
        toast("Message sent. We will get back to you soon.", "ok");
        form.message.value = "";
        form.subject.value = "";
      } catch (err) {
        toast(err.message, "err");
      }
      btn.disabled = false;
    });
  }

  /* ---------- admin ---------- */
  async function initAdmin() {
    const app = $("#admin-app");
    if (!app) return;
    if (!requireLogin()) return;
    const u = user();
    if (!u || u.role !== "admin") {
      app.innerHTML = "<p>You do not have access to this page.</p>";
      return;
    }
    const tabs = ["dashboard", "orders", "products", "messages", "users"];
    let tab = "dashboard";
    const nav = $("#admin-tabs");
    nav.innerHTML = tabs
      .map(
        (t) =>
          '<button class="normal" data-tab="' +
          t +
          '">' +
          t[0].toUpperCase() +
          t.slice(1) +
          "</button>",
      )
      .join("");
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("[data-tab]");
      if (b) {
        tab = b.dataset.tab;
        render();
      }
    });
    const view = $("#admin-view");

    async function render() {
      $$("#admin-tabs button").forEach((b) =>
        b.classList.toggle("on", b.dataset.tab === tab),
      );
      view.innerHTML = "<p>Loading…</p>";
      try {
        await views[tab]();
      } catch (e) {
        view.innerHTML = "<p>" + esc(e.message) + "</p>";
      }
    }

    const views = {
      async dashboard() {
        const s = await api("/admin/stats");
        view.innerHTML =
          '<div class="stat-grid">' +
          [
            ["Revenue", money(s.revenue)],
            ["Orders", s.orders],
            ["Customers", s.users],
            ["Products", s.products],
          ]
            .map(
              (x) =>
                '<div class="stat"><span>' +
                x[0] +
                "</span><b>" +
                x[1] +
                "</b></div>",
            )
            .join("") +
          "</div>" +
          "<h4>Low stock (5 or fewer)</h4>" +
          (s.lowStock.length
            ? '<ul class="plain">' +
              s.lowStock
                .map(
                  (p) => "<li>" + esc(p.name) + ": <b>" + p.stock + "</b></li>",
                )
                .join("") +
              "</ul>"
            : "<p>Nothing running low.</p>");
      },
      async orders() {
        const list = await api("/admin/orders");
        view.innerHTML =
          '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Update</th></tr></thead><tbody>' +
          (list.length
            ? list
                .map(
                  (o) =>
                    "<tr><td>#" +
                    o._id.slice(-6).toUpperCase() +
                    "<br><small>" +
                    new Date(o.createdAt).toLocaleDateString() +
                    "</small></td>" +
                    "<td>" +
                    esc(o.user ? o.user.name : "?") +
                    "<br><small>" +
                    esc(o.user ? o.user.email : "") +
                    "</small><br><small>" +
                    esc(o.shippingAddress.phone || "") +
                    " · " +
                    esc(o.shippingAddress.line1 || "") +
                    ", " +
                    esc(o.shippingAddress.city || "") +
                    "</small></td>" +
                    "<td>" +
                    o.items
                      .map(
                        (i) =>
                          esc(i.name) +
                          (i.size ? " (" + esc(i.size) + ")" : "") +
                          " × " +
                          i.qty,
                      )
                      .join("<br>") +
                    "</td>" +
                    "<td>" +
                    money(o.total) +
                    "</td><td>" +
                    badge(o.status) +
                    "</td>" +
                    "<td>" +
                    (o.status === "pending"
                      ? "<small>Awaiting payment</small>"
                      : '<select data-order="' +
                        o._id +
                        '"><option value="">Set status…</option><option>shipped</option><option>delivered</option><option>cancelled</option></select>') +
                    "</td></tr>",
                )
                .join("")
            : '<tr><td colspan="6">No orders yet.</td></tr>') +
          "</tbody></table></div>";
        view.onchange = async (e) => {
          const sel = e.target.closest("[data-order]");
          if (!sel || !sel.value) return;
          try {
            await api("/admin/orders/" + sel.dataset.order + "/status", {
              method: "PUT",
              body: { status: sel.value },
            });
            toast("Order updated", "ok");
            render();
          } catch (err) {
            toast(err.message, "err");
          }
        };
      },
      async products() {
        const list = await api("/admin/products");
        view.innerHTML =
          '<button class="normal add-new" id="new-product">+ New product</button><div id="product-form"></div>' +
          '<div class="table-wrap"><table class="admin-table"><thead><tr><th></th><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>' +
          list
            .map(
              (p) =>
                '<tr><td><img src="' +
                esc(p.images[0] || "") +
                '" width="46" alt=""></td><td>' +
                esc(p.name) +
                "<br><small>" +
                esc(p.brand) +
                " · " +
                esc(p.category) +
                "</small></td>" +
                "<td>" +
                money(p.price) +
                '</td><td><input class="stock-input" type="number" min="0" value="' +
                p.stock +
                '" data-stock="' +
                p._id +
                '"></td>' +
                "<td>" +
                (p.active ? "Active" : "<i>Hidden</i>") +
                "</td>" +
                '<td><a href="#" data-edit="' +
                p._id +
                '">Edit</a> · <a href="#" data-toggle="' +
                p._id +
                '" data-active="' +
                p.active +
                '">' +
                (p.active ? "Hide" : "Show") +
                "</a></td></tr>",
            )
            .join("") +
          "</tbody></table></div>";
        const byId = Object.fromEntries(list.map((p) => [p._id, p]));
        function form(p) {
          p = p || {
            name: "",
            brand: "",
            category: "",
            price: "",
            stock: 0,
            sizes: [],
            images: [],
            description: "",
            featured: false,
            newArrival: false,
          };
          $("#product-form").innerHTML =
            '<form class="admin-form" id="pf"><h4>' +
            (p._id ? "Edit product" : "New product") +
            "</h4>" +
            '<input name="name" placeholder="Name" required value="' +
            esc(p.name) +
            '">' +
            '<input name="brand" placeholder="Brand" value="' +
            esc(p.brand) +
            '">' +
            '<input name="category" placeholder="Category" value="' +
            esc(p.category) +
            '">' +
            '<input name="price" type="number" min="0" step="any" placeholder="Price" required value="' +
            esc(p.price) +
            '">' +
            '<input name="stock" type="number" min="0" placeholder="Stock" required value="' +
            esc(p.stock) +
            '">' +
            '<input name="sizes" placeholder="Sizes, comma separated (Small, Large, XL)" value="' +
            esc((p.sizes || []).join(", ")) +
            '">' +
            '<input name="images" placeholder="Image paths, comma separated (img/products/f1.jpg)" required value="' +
            esc((p.images || []).join(", ")) +
            '">' +
            '<textarea name="description" rows="3" placeholder="Description">' +
            esc(p.description) +
            "</textarea>" +
            '<label><input type="checkbox" name="featured" ' +
            (p.featured ? "checked" : "") +
            "> Featured</label> " +
            '<label><input type="checkbox" name="newArrival" ' +
            (p.newArrival ? "checked" : "") +
            "> New arrival</label>" +
            '<div><button class="normal save" type="submit">Save</button> <button class="normal" type="button" id="pf-cancel">Cancel</button></div></form>';
          $("#pf-cancel").onclick = () => {
            $("#product-form").innerHTML = "";
          };
          $("#pf").onsubmit = async (ev) => {
            ev.preventDefault();
            const f = ev.target;
            const csv = (v) =>
              v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const body = {
              name: f.elements.name.value,
              brand: f.brand.value,
              category: f.category.value,
              price: Number(f.price.value),
              stock: Number(f.stock.value),
              sizes: csv(f.sizes.value),
              images: csv(f.images.value),
              description: f.description.value,
              featured: f.featured.checked,
              newArrival: f.newArrival.checked,
            };
            try {
              await api(p._id ? "/products/" + p._id : "/products", {
                method: p._id ? "PUT" : "POST",
                body,
              });
              toast("Product saved", "ok");
              render();
            } catch (err) {
              toast(err.message, "err");
            }
          };
          $("#product-form").scrollIntoView({ behavior: "smooth" });
        }
        $("#new-product").onclick = () => form();
        view.onclick = async (e) => {
          const ed = e.target.closest("[data-edit]"),
            tg = e.target.closest("[data-toggle]");
          if (ed) {
            e.preventDefault();
            form(byId[ed.dataset.edit]);
          }
          if (tg) {
            e.preventDefault();
            try {
              await api("/products/" + tg.dataset.toggle, {
                method: "PUT",
                body: { active: tg.dataset.active !== "true" },
              });
              render();
            } catch (err) {
              toast(err.message, "err");
            }
          }
        };
        view.onchange = async (e) => {
          const inp = e.target.closest("[data-stock]");
          if (!inp) return;
          try {
            await api("/admin/inventory/" + inp.dataset.stock, {
              method: "PUT",
              body: { stock: inp.value },
            });
            toast("Stock updated", "ok");
          } catch (err) {
            toast(err.message, "err");
          }
        };
      },
      async messages() {
        const list = await api("/admin/messages");
        view.innerHTML = list.length
          ? list
              .map(
                (m) =>
                  '<div class="order-card"><b>' +
                  esc(m.subject || "(no subject)") +
                  "</b><br><small>" +
                  esc(m.name) +
                  " · " +
                  esc(m.email) +
                  " · " +
                  new Date(m.createdAt).toLocaleString() +
                  "</small><p>" +
                  esc(m.message) +
                  "</p></div>",
              )
              .join("")
          : "<p>No messages yet.</p>";
      },
      async users() {
        const list = await api("/admin/users");
        view.innerHTML =
          '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead><tbody>' +
          list
            .map(
              (x) =>
                "<tr><td>" +
                esc(x.name) +
                "</td><td>" +
                esc(x.email) +
                "</td><td>" +
                esc(x.role) +
                "</td><td>" +
                new Date(x.createdAt).toLocaleDateString() +
                "</td></tr>",
            )
            .join("") +
          "</tbody></table></div>";
      },
    };
    render();
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      CONFIG = Object.assign(CONFIG, await api("/config"));
    } catch (e) {
      /* defaults */
    }
    initChrome();
    initListings();
    initProduct();
    initCart();
    initAuth();
    initCheckout();
    initOrders();
    initSuccess();
    initContact();
    initAdmin();
  }
  boot();
})();
