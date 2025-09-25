import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });
import payosService from "./payos.service.js";
console.log("PAYOS_CLIENT_ID:", process.env.PAYOS_CLIENT_ID);
console.log("PAYOS_API_KEY:", process.env.PAYOS_API_KEY);
console.log("PAYOS_CHECKSUM_KEY:", process.env.PAYOS_CHECKSUM_KEY);
payosService.testMinimalSignature().then(console.log);
