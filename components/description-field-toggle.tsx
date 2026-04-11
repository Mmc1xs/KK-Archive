"use client";

import { useState } from "react";

type DescriptionFieldToggleProps = {
  initialValue?: string;
  defaultEnabled?: boolean;
};

export function DescriptionFieldToggle({
  initialValue = "",
  defaultEnabled = false
}: DescriptionFieldToggleProps) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [value, setValue] = useState(initialValue);

  return (
    <div className="field">
      <div className="split">
        <label htmlFor="descriptionEnabled">Description</label>
        <label className="link-pill" htmlFor="descriptionEnabled" style={{ cursor: "pointer" }}>
          <input
            id="descriptionEnabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            style={{ marginRight: 8 }}
          />
          Enable
        </label>
      </div>
      <small className="muted">
        Leave this off for normal posts. Turn it on only when this content really needs extra description text.
      </small>
      {enabled ? (
        <textarea
          id="description"
          name="description"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Optional description"
        />
      ) : (
        <input type="hidden" name="description" value="" />
      )}
    </div>
  );
}
