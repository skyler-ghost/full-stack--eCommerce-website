const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", "config.env") });
const mongoose = require("mongoose");
const Product = require("../models/Product");
const User = require("../models/User");

const SIZES = ["Small", "Large", "XL", "XXL"];
const img = n => `img/products/${n}.jpg`;
const catalog = [
  ["f1", ["f1", "f2", "f3", "f4"], 15000], ["f2", ["f2", "f1", "f3", "f4"], 15000],
  ["f3", ["f2", "f1", "f3", "f4"], 16500], ["f4", ["f2", "f1", "f3", "f4"], 16500],
  ["f5", ["f5", "f6", "f7", "f8"], 18000], ["f2", ["f6", "f5", "f7", "f8"], 18000],
  ["f7", ["f6", "f5", "f7", "f8"], 19500], ["f8", ["f8", "f6", "f7", "f5"], 19500],
  ["n1", ["n4", "n2", "n1", "n3"], 21000], ["n2", ["n3", "n1", "n2", "n4"], 21000],
  ["n3", ["n1", "n2", "n3", "n4"], 22500], ["n4", ["n1", "n2", "n4", "n3"], 22500],
  ["n5", ["n6", "n5", "n7", "n8"], 24000], ["n6", ["n5", "n6", "n7", "n8"], 24000],
  ["n7", ["n7", "n8", "n6", "n5"], 25500], ["n8", ["n8", "n5", "n6", "n7"], 25500]
];
const DESCRIPTION = "The Gildan Ultra Cotton T-shirt is made from a substantial 6.0 oz. per sq. yd. fabric constructed from 100% cotton, this classic fit preshrunk jersey knit provides unmatched comfort with each wear. Featuring a taped neck and shoulder, and a seamless double-needle collar, and available in a range of colors, it offers it all in the ultimate head-turning package.";

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const force = process.argv.includes("--force");
  if (force) await Product.deleteMany({});
  if (!(await Product.countDocuments())) {
    for (const [i, [main, gallery, price]] of catalog.entries()) {
      await Product.create({
        name: "Cartoon Astronaut T-Shirt", brand: "skywears", category: "T-Shirt", price, stock: 25,
        sizes: SIZES, images: [main, ...gallery.filter(g => g !== main)].map(img),
        featured: i < 8, newArrival: i >= 8, description: DESCRIPTION
      });
    }
    console.log(`Seeded ${catalog.length} products`);
  } else console.log("Products already exist (use --force to reseed)");

  const email = (process.env.ADMIN_EMAIL || "admin@myshop.com").toLowerCase();
  if (!(await User.findOne({ email }))) {
    await User.create({ name: "Admin", email, password: process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!", role: "admin" });
    console.log("Admin created:", email);
  }
  process.exit(0);
})();
