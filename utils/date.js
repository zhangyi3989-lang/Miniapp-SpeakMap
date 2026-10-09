const day = (value) => {
  const d = new Date(value === undefined ? Date.now() : value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addDays = (value, days) => {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};
module.exports = {
  day,
  addDays,
  due: (value, now = Date.now()) => !!value && new Date(value).getTime() <= now,
};
