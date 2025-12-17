import { Employee } from './types';

// This is the permanent database stored in the code.
// To update this for everyone:
// 1. Load the app, Import your CSV or add entries.
// 2. Go to Settings -> Unlock -> Click "<> Copy DB Code"
// 3. Paste the copied content here replacing the array below.

export const INITIAL_DB: Employee[] = [
  // Example Entry (You can remove this)
  {
    id: "static-1",
    name: "Demo Employee",
    cardNo: "000",
    designation: "S/O",
    defaultTaka: 50
  }
];