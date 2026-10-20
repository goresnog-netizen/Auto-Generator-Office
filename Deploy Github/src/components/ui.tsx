/**
 * Common UI Components for NitZ-909 (React JSX)
 */
import React from "react";
import type { ThemeTokens } from "../types";

/* ===== BUTTON ===== */
export interface ButtonProps {
  children: React.ReactNode;
  type?: "primary" | "secondary" | "danger" | "outline" | "quiet";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  block?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  title?: string;
}

export const Button = ({
  children,
  type = "primary",
  size = "md",
  disabled = false,
  onClick,
  className,
  block = false,
  loading = false,
  icon,
  title,
}: ButtonProps) => {
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { height: "var(--control-height-sm)", fontSize: "var(--font-size-sm)" },
    md: { height: "var(--control-height-md)", fontSize: "var(--font-size-md)" },
    lg: { height: "var(--control-height-lg)", fontSize: "var(--font-size-lg)" },
  };
  const typeStyles: Record<string, React.CSSProperties> = {
    primary: {
      color: "var(--primary-action-text)",
      background: "var(--primary-action)",
      border: "1px solid transparent",
    },
    secondary: {
      color: "var(--text)",
      background: "var(--surface-2)",
      border: "1px solid var(--control-border)",
    },
    danger: {
      color: "var(--danger-text)",
      background: "color-mix(in srgb, var(--danger) 10%, var(--surface))",
      border: "1px solid color-mix(in srgb, var(--danger) 30%, var(--border))",
    },
    outline: {
      color: "var(--text)",
      background: "transparent",
      border: "1px solid var(--control-border)",
    },
    quiet: {
      color: "var(--muted)",
      background: "transparent",
      border: "1px solid transparent",
    },
  };
  return (
    <button
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        padding: "0 var(--space-4)",
        borderRadius: "var(--radius)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: block ? "100%" : undefined,
        transition: "background 0.15s ease, color 0.15s ease",
        ...sizeStyles[size],
        ...typeStyles[type],
      }}
    >
      {icon}
      {loading && (
        <span
          className="spinner"
          style={{
            width: "16px",
            height: "16px",
            border: "2px solid currentColor",
            borderRadius: "50%",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}
        />
      )}
      {children}
    </button>
  );
};

/* ===== SECTION HEADER — judul seksi konsisten + ikon + aksi ===== */
export const SectionHeader = ({
  ikon,
  judul,
  deskripsi,
  aksi,
}: {
  ikon?: React.ReactNode;
  judul: string;
  deskripsi?: string;
  aksi?: React.ReactNode;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "var(--space-3)",
      marginBottom: "var(--space-3)",
    }}
  >
    {ikon && (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "var(--radius-md)",
          background: "color-mix(in srgb, var(--brand) 14%, var(--surface))",
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {ikon}
      </span>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <strong style={{ fontSize: "var(--font-size-ui)", display: "block" }}>{judul}</strong>
      {deskripsi && (
        <span style={{ fontSize: "var(--font-size-caption)", color: "var(--muted)", lineHeight: 1.5, display: "block", marginTop: 2 }}>{deskripsi}</span>
      )}
    </div>
    {aksi}
  </div>
);

/* ===== TEMPLATE CARD — kartu galeri konsisten hover + selected ===== */
export const TemplateCard = ({
  selected,
  onPilih,
  children,
}: {
  selected?: boolean;
  onPilih?: () => void;
  children: React.ReactNode;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onPilih}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPilih?.();
      }
    }}
    className="kartu-template"
    style={{
      background: selected ? "color-mix(in srgb, var(--brand) 10%, var(--surface))" : "var(--surface)",
      border: selected ? "1.5px solid var(--brand)" : "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-3)",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)",
      minHeight: 200,
    }}
  >
    {children}
  </div>
);

/* ===== STAT CHIP — angka ringkas kanvas/galeri ===== */
export const StatChip = ({ angka, label }: { angka: string | number; label: string }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "baseline",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 99,
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      fontSize: "var(--font-size-caption)",
      color: "var(--muted)",
    }}
  >
    <strong style={{ fontSize: "var(--font-size-ui)", color: "var(--text)" }}>{angka}</strong>
    {label}
  </span>
);

/* ===== INPUT ===== */
export interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholderColor?: string;
  className?: string;
  required?: boolean;
}

export const Input = ({
  type = "text",
  placeholder,
  value,
  onChange,
  disabled = false,
  placeholderColor,
  className,
  required = false,
}: InputProps) => (
  <input
    type={type}
    className={className}
    placeholder={placeholder}
    value={value}
    required={required}
    disabled={disabled}
    onChange={(e) => onChange?.(e.target.value)}
    style={{
      height: "var(--control-height-md)",
      width: "100%",
      padding: "0 var(--space-3)",
      color: "var(--text)",
      background: "var(--control-bg)",
      border: "1px solid var(--control-border)",
      borderRadius: "var(--radius)",
      outline: "none",
      opacity: disabled ? 0.5 : 1,
      ...(placeholderColor
        ? ({ "--ph": placeholderColor } as React.CSSProperties)
        : {}),
    }}
  />
);

/* ===== TEXTAREA ===== */
export interface TextareaProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  /** Petunjuk kecil di bawah field. */
  hint?: string;
}

export const Textarea = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
  className,
  hint,
}: TextareaProps) => (
  <label
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)",
      width: "100%",
    }}
  >
    {label && (
      <span style={{ fontSize: "var(--font-size-label)", color: "var(--muted)" }}>
        {label}
      </span>
    )}
    <textarea
      className={className}
      value={value}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "var(--space-3)",
        color: "var(--text)",
        background: "var(--control-bg)",
        border: "1px solid var(--control-border)",
        borderRadius: "var(--radius)",
        outline: "none",
        opacity: disabled ? 0.5 : 1,
        resize: "vertical",
        fontFamily: "inherit",
        fontSize: "var(--font-size-ui)",
        lineHeight: 1.5,
      }}
    />
    {hint && (
      <span style={{ fontSize: "var(--font-size-caption)", color: "var(--faint)" }}>
        {hint}
      </span>
    )}
  </label>
);

/* ===== BADGE ===== */
export interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "warn" | "error";
  size?: "sm" | "md";
}

export const Badge = ({
  children,
  variant = "secondary",
  size = "md",
}: BadgeProps) => {
  const variantStyle: Record<string, React.CSSProperties> = {
    primary: {
      color: "var(--primary-action-text)",
      background: "color-mix(in srgb, var(--brand) 20%, var(--surface))",
      border: "1px solid color-mix(in srgb, var(--brand) 30%, var(--border))",
    },
    secondary: {
      color: "var(--muted)",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
    },
    success: {
      color: "var(--success-text)",
      background: "color-mix(in srgb, var(--green) 20%, var(--surface))",
      border: "1px solid color-mix(in srgb, var(--green) 30%, var(--border))",
    },
    error: {
      color: "var(--danger-text)",
      background: "color-mix(in srgb, var(--danger) 20%, var(--surface))",
      border: "1px solid color-mix(in srgb, var(--danger) 30%, var(--border))",
    },
    danger: {
      color: "var(--danger-text)",
      background: "color-mix(in srgb, var(--danger) 20%, var(--surface))",
      border: "1px solid color-mix(in srgb, var(--danger) 30%, var(--border))",
    },
    warn: {
      color: "var(--warning-text)",
      background: "color-mix(in srgb, var(--warn) 20%, var(--surface))",
      border: "1px solid color-mix(in srgb, var(--warn) 30%, var(--border))",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding:
          size === "sm"
            ? "1px var(--space-2)"
            : "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius)",
        fontSize: size === "sm" ? "var(--font-size-xs)" : "var(--font-size-sm)",
        ...variantStyle[variant],
      }}
    >
      {children}
    </span>
  );
};

/* ===== CARD =====
   Memakai token kaca (`--glass-*`) dari src/styles/glass.css, bukan warna
   datar: seluruh aplikasi jadi satu bahasa visual, dan panel tetap punya
   "berlapis" di atas latar mesh. `glass.css`_rules_override nilai inline
   lewat `!important` untuk background/border/radius, jadi aman. */
export const Card = ({
  children,
  elevated = false,
  className,
}: {
  children: React.ReactNode;
  elevated?: boolean;
  className?: string;
}) => (
  <div
    className={className ? `kartu-kaca ${className}` : "kartu-kaca"}
    style={{
      background: "var(--glass-bg)",
      border: "1px solid var(--glass-border)",
      borderRadius: "var(--glass-radius)",
      padding: "var(--space-4)",
      boxShadow: elevated
        ? "var(--glass-highlight), var(--glass-edge), var(--glass-shadow-lg)"
        : undefined,
    }}
  >
    {children}
  </div>
);

/* ===== DIVIDER ===== */
export const Divider = () => (
  <hr
    style={{
      border: "none",
      borderTop: "1px solid var(--border)",
      margin: "var(--space-4) 0",
    }}
  />
);

/* ===== TOOLTIP ===== */
export const Tooltip = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <span style={{ position: "relative", display: "inline-flex" }} title={label}>
    {children}
  </span>
);

/* ===== NAV ===== */
export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  onClick?: () => void;
}

export const Nav = ({
  items,
  vertical = false,
  onSelect,
}: {
  items: NavItem[];
  vertical?: boolean;
  onSelect?: (item: NavItem) => void;
}) => (
  <nav
    style={{
      display: "flex",
      flexDirection: vertical ? "column" : "row",
      gap: "var(--space-3)",
      alignItems: vertical ? "flex-start" : "center",
      margin: "var(--space-4) 0",
    }}
  >
    {items.map((item) => (
      <div
        key={item.id}
        onClick={() => {
          item.onClick?.();
          onSelect?.(item);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius)",
          cursor: "pointer",
          color: "var(--muted)",
          transition: "color 0.15s ease",
        }}
      >
        {item.icon && (
          <span style={{ width: "16px", height: "16px" }}>{item.icon}</span>
        )}
        {item.label}
      </div>
    ))}
  </nav>
);

/* ===== useDocumentStats ===== */
export const useDocumentStats = (blocks: { type: string }[]) => {
  const stats = { total: 0, headings: 0, paragraphs: 0, lists: 0 };
  blocks.forEach((block) => {
    stats.total++;
    if (block.type === "heading") stats.headings++;
    else if (block.type === "paragraph") stats.paragraphs++;
    else if (block.type === "list") stats.lists++;
  });
  return stats;
};

/* ===== SELECT ===== */
export interface SelectProps {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export const Select = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SelectProps) => (
  <label
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-1)",
      fontSize: "var(--font-size-ui)",
      color: "var(--muted)",
    }}
  >
    {label && <span>{label}</span>}
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        height: "var(--control-height-md)",
        padding: "0 var(--space-3)",
        color: "var(--text)",
        background: "var(--control-bg)",
        border: "1px solid var(--control-border)",
        borderRadius: "var(--radius)",
        outline: "none",
        fontSize: "var(--font-size-ui)",
        cursor: "pointer",
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </label>
);

/* ===== ALERT ===== */
export const Alert = ({
  variant = "info",
  children,
}: {
  variant?: "success" | "error" | "info";
  children: React.ReactNode;
}) => {
  const styles: Record<string, React.CSSProperties> = {
    success: {
      color: "var(--success-text)",
      background: "color-mix(in srgb, var(--ok) 10%, var(--surface))",
      border: "1px solid color-mix(in srgb, var(--ok) 30%, var(--border))",
    },
    error: {
      color: "var(--danger-text)",
      background: "color-mix(in srgb, var(--danger) 10%, var(--surface))",
      border: "1px solid color-mix(in srgb, var(--danger) 30%, var(--border))",
    },
    info: {
      color: "var(--text)",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
    },
  };
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius)",
        fontSize: "var(--font-size-ui)",
        lineHeight: 1.5,
        ...styles[variant],
      }}
    >
      {children}
    </div>
  );
};

/* ===== EMPTY STATE ===== */
export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "var(--space-3)",
      padding: "var(--space-8) var(--space-5)",
      textAlign: "center",
    }}
  >
    <span style={{ display: "inline-flex" }}>{icon}</span>
    <strong style={{ fontSize: "var(--font-size-title)" }}>{title}</strong>
    <p
      style={{
        margin: 0,
        maxWidth: "420px",
        color: "var(--muted)",
        fontSize: "var(--font-size-ui)",
        lineHeight: 1.6,
      }}
    >
      {description}
    </p>
    {action}
  </div>
);

export type { ThemeTokens };
