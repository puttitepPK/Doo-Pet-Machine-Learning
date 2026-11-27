import { AlertCircle } from "lucide-react";
export const Disclaimer = ({ children }) => (
  <p className="notice"><AlertCircle size={18} />{children}</p>
);
