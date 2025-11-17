import React from "react";

/**
 * Component for displaying error messages
 */
export default function ErrorDisplay({ error }) {
  if (!error) return null;

  return (
    <div className="p-3 bg-red-100 text-red-800 rounded mb-4">{error}</div>
  );
}
