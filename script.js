import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const sheetUrls = {
  sheet1:
    "https://docs.google.com/spreadsheets/d/1K2Emi5_yafsM6eJh3C-QETRbN9bo0vbWywaHI_EDeRA/export?format=csv",
};
let currentVoucherData = null;

async function fetchData(sheetKey, inputId) {
  const voucherCode = document.getElementById(inputId).value.trim();
  if (!voucherCode) {
    Swal.fire({
      icon: "warning",
      title: "Empty Field!",
      text: "Please enter a voucher code.",
      confirmButtonColor: "#3085d6",
    });
    return;
  }

  try {
    // First check if the voucher exists in Firestore
    const voucherRef = doc(db, "claimedVouchers", voucherCode);
    const voucherDoc = await getDoc(voucherRef);

    if (voucherDoc.exists()) {
      // Voucher already claimed - show who claimed it and when
      const data = voucherDoc.data();
      Swal.fire({
        icon: "error",
        title: "Voucher Already Claimed!",
        html: `
          <p>This voucher has already been claimed by:</p>
          <p><strong>Name:</strong> ${data.name || "N/A"}</p>
          <p><strong>Email:</strong> ${data.email || "N/A"}</p>
          <p><strong>Reward:</strong> ${data.reward || "N/A"}</p>
          <p><strong>Claimed On:</strong> ${
            new Date(data.claimedAt).toLocaleString() || "N/A"
          }</p>
        `,
        confirmButtonColor: "#d33",
      });
      return;
    }

    // If not found in Firestore, fetch from spreadsheet
    await fetchFromSpreadsheet(sheetKey, voucherCode);
  } catch (error) {
    console.error("Error checking voucher in Firestore:", error);
    // If there's an error with Firestore, still try spreadsheet as fallback
    await fetchFromSpreadsheet(sheetKey, voucherCode);
  }
}

async function fetchFromSpreadsheet(sheetKey, voucherCode) {
  // Add a timestamp to force fresh data fetch and prevent caching
  const url = `${sheetUrls[sheetKey]}&t=${Date.now()}`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvData = await response.text();

    // Log the first part of CSV data for debugging
    console.log("CSV data sample:", csvData.substring(0, 500));

    // Split CSV into rows
    const rows = csvData.split("\n");

    // Log column headers to verify structure
    if (rows.length > 0) {
      console.log("CSV Headers:", rows[0]);
    }

    // Parse actual data rows, skipping header
    const dataRows = rows.slice(1).map((row) => {
      // Split by comma but handle potential CSV complexities
      return row.split(",").map((cell) => cell.trim());
    });

    console.log(`Parsed ${dataRows.length} data rows from CSV`);
    console.log("Looking for voucher code:", voucherCode);

    // Check which column has voucher codes by logging a sample row
    if (dataRows.length > 0) {
      console.log("Sample row:", dataRows[0]);
    }

    // Look for the voucher code with flexible column checking
    let foundRow = null;
    let voucherColumnIndex = -1;

    // Try to find which column contains voucher codes
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      for (let j = 0; j < row.length; j++) {
        if (row[j] === voucherCode) {
          foundRow = row;
          voucherColumnIndex = j;
          console.log(`Found voucher in row ${i}, column ${j}`);
          break;
        }
      }
      if (foundRow) break;
    }

    if (foundRow) {
      console.log("Voucher found! Complete row:", foundRow);

      // Get data based on detected column positions or fallback to default
      const columnIndex = {
        timestamp: 0,
        name: 1,
        email: 2,
        reward: 3,
        screenshot: 4,
        voucherCode: voucherColumnIndex !== -1 ? voucherColumnIndex : 5,
        expiryDate: 6,
        status: 7,
      };

      // Extract data with better error handling
      const extractSafe = (row, index, defaultValue = "N/A") => {
        return row.length > index && row[index] ? row[index] : defaultValue;
      };

      currentVoucherData = {
        timestamp: extractSafe(foundRow, columnIndex.timestamp),
        name: extractSafe(foundRow, columnIndex.name),
        email: extractSafe(foundRow, columnIndex.email),
        reward: extractSafe(foundRow, columnIndex.reward),
        screenshot: extractSafe(foundRow, columnIndex.screenshot),
        voucherCode: voucherCode,
        expiryDate: extractSafe(foundRow, columnIndex.expiryDate),
        status: extractSafe(foundRow, columnIndex.status),
        claimedAt: new Date().toISOString(),
      };

      // Show the data and ask to claim
      Swal.fire({
        title: "Voucher Found!",
        html: `
          <p><strong>Name:</strong> ${currentVoucherData.name}</p>
          <p><strong>Email:</strong> ${currentVoucherData.email}</p>
          <p><strong>Reward:</strong> ${currentVoucherData.reward}</p>
          <p><strong>Expiry Date:</strong> ${currentVoucherData.expiryDate}</p>
          <p><strong>Status:</strong> ${currentVoucherData.status}</p>
        `,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Claim Reward",
        cancelButtonText: "Close",
        confirmButtonColor: "#28a745",
      }).then((result) => {
        if (result.isConfirmed) {
          claimReward();
        }
      });
    } else {
      console.log("No matching voucher found in any column of the spreadsheet");
      // Voucher not found in spreadsheet
      Swal.fire({
        icon: "error",
        title: "Not Found!",
        text: "Voucher code not found in our database. Please check the code and try again.",
        confirmButtonColor: "#d33",
      });
    }
  } catch (error) {
    console.error("Error fetching data from spreadsheet:", error);
    Swal.fire({
      icon: "error",
      title: "Network Error!",
      text: "Failed to fetch data from the spreadsheet: " + error.message,
      confirmButtonColor: "#d33",
    });
  }
}

async function claimReward() {
  if (currentVoucherData) {
    try {
      // Save voucher data to Firestore using the voucher code as document ID
      const voucherRef = doc(
        db,
        "claimedVouchers",
        currentVoucherData.voucherCode
      );
      await setDoc(voucherRef, {
        ...currentVoucherData,
        claimedAt: new Date().toISOString(), // Update timestamp to the exact claim time
      });

      Swal.fire({
        icon: "success",
        title: "Reward Claimed!",
        text: "Your reward has been successfully claimed and recorded.",
        confirmButtonColor: "#28a745",
      });

      // Reset the current voucher data
      currentVoucherData = null;

      // Clear the input field
      document.getElementById("voucher1").value = "";
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      Swal.fire({
        icon: "error",
        title: "Error Saving Data!",
        text:
          "There was a problem recording your claim. Please try again: " +
          error.message,
        confirmButtonColor: "#d33",
      });
    }
  } else {
    Swal.fire({
      icon: "warning",
      title: "No Voucher Selected!",
      text: "Please fetch voucher details before claiming.",
      confirmButtonColor: "#3085d6",
    });
  }
}

// Expose the functions globally
window.fetchData = fetchData;
window.claimReward = claimReward;
