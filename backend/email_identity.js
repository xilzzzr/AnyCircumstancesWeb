// MySQL's default collations compare text case- and accent-insensitively, so
// `WHERE email = ?` can match a different, look-alike address (for example
// "name@exämple.com" against "name@example.com"). Account lookups must only
// accept the row when the stored address is the one that was entered.

function canonicalEmail(email) {
  return String(email || "").trim().normalize("NFC").toLowerCase();
}

function sameEmail(storedEmail, enteredEmail) {
  const stored = canonicalEmail(storedEmail);
  return stored !== "" && stored === canonicalEmail(enteredEmail);
}

module.exports = { canonicalEmail, sameEmail };
