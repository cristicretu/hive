import { useState } from "react";

const commands = [
  { label: "npm", command: "npm i -g @cristicretu/hive-cli" },
  { label: "bun", command: "bun add -g @cristicretu/hive-cli" },
  { label: "pnpm", command: "pnpm add -g @cristicretu/hive-cli" },
  { label: "yarn", command: "yarn global add @cristicretu/hive-cli" },
];

export default function InstallCommand() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(commands[activeTab].command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {commands.map((cmd, index) => (
          <button
            key={cmd.label}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-2 text-[13px] font-medium transition-colors ${activeTab === index
                ? "text-gray-900 bg-white border-b-2 border-gray-900 -mb-px"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Command */}
      <div className="p-4 flex items-center justify-between gap-4">
        <code className="font-mono text-[13px] text-gray-800">
          {commands[activeTab].command}
        </code>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-2 hover:bg-gray-200 rounded transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13.5 4.5L6 12L2.5 8.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="5.5"
                y="5.5"
                width="8"
                height="8"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M10.5 5.5V3.5C10.5 2.67157 9.82843 2 9 2H3.5C2.67157 2 2 2.67157 2 3.5V9C2 9.82843 2.67157 10.5 3.5 10.5H5.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
