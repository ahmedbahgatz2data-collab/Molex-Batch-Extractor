import React, { useState, useRef } from 'react';
import { 
  Link2, 
  FileText, 
  Upload, 
  Play, 
  Sparkles, 
  Trash2, 
  Settings2, 
  Plus, 
  Check, 
  AlertCircle,
  Shield,
  Clipboard,
  Cpu,
  Layers
} from 'lucide-react';
import { ExtractionConfig } from '../types/extractor';

interface UrlInputSectionProps {
  onProcessUrls: (urls: string[]) => void;
  onProcessRawJson: (jsonData: unknown, sourceName: string) => void;
  isLoading: boolean;
  config: ExtractionConfig;
  onConfigChange: (config: ExtractionConfig) => void;
}

export const UrlInputSection: React.FC<UrlInputSectionProps> = ({
  onProcessUrls,
  onProcessRawJson,
  isLoading,
  config,
  onConfigChange,
}) => {
  const [activeTab, setActiveTab] = useState<'urls' | 'paste' | 'upload'>('urls');
  const [urlsText, setUrlsText] = useState<string>('');
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [headerKey, setHeaderKey] = useState<string>('');
  const [headerValue, setHeaderValue] = useState<string>('');
  const [cookieInput, setCookieInput] = useState<string>(config.stealthOptions?.customCookies || '');
  const [proxyUrlInput, setProxyUrlInput] = useState<string>(config.stealthOptions?.customProxyUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse lines into clean valid URLs
  const parseUrls = (text: string): string[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  };

  const parsedUrlCount = parseUrls(urlsText).length;

  const handleStartExtraction = () => {
    const urls = parseUrls(urlsText);
    if (urls.length === 0) return;
    onProcessUrls(urls);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        alert('Clipboard is empty. Copy some URLs or JSON first.');
        return;
      }
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          onProcessRawJson(parsed, 'Clipboard JSON');
          return;
        } catch {
          // not valid json, fall back to urls
        }
      }
      // Paste into urls textarea
      setUrlsText((prev) => (prev ? `${prev}\n${trimmed}` : trimmed));
      setActiveTab('urls');
    } catch {
      alert('Could not access clipboard. Please paste manually into the text box.');
    }
  };

  const handleProcessRawJson = () => {
    setRawJsonError(null);
    if (!rawJsonText.trim()) return;

    try {
      const parsed = JSON.parse(rawJsonText);
      onProcessRawJson(parsed, 'Pasted Raw JSON');
    } catch (err) {
      setRawJsonError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          onProcessRawJson(parsed, file.name);
        } catch {
          alert('Could not parse file as JSON');
        }
      } else {
        // Assume text/csv list of URLs
        const lines = content
          .split(/[\r\n]+/)
          .map((l) => l.trim())
          .filter((l) => l.startsWith('http://') || l.startsWith('https://') || l.startsWith('/'));

        if (lines.length > 0) {
          setUrlsText(lines.join('\n'));
          setActiveTab('urls');
        } else {
          alert('No valid URLs found in file.');
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadMolexSingleExample = () => {
    const molexUrl = 'https://search.molex.com/api/search/productdetails?q=1200661244';
    setUrlsText(molexUrl);
    setActiveTab('urls');
  };

  const loadMolexBatchExample = () => {
    const molexUrls = [
      'https://search.molex.com/api/search/productdetails?q=1200661244',
      'https://www.molex.com/bin/molex/mulesoft/unpublished-part?partNumber=1200661244'
    ].join('\n');
    setUrlsText(molexUrls);
    setActiveTab('urls');
  };

  const loadRawJsonSample = () => {
    const sample = [
      {
        productNumberDisplay: "855055114",
        productNumberHyphen: "85505-5114",
        productNumberSap: "0855055114",
        productStatus: "Obsolescence",
        description: "Modular Jack, Right-Angle, Low Profile, Surface Mount, 8/8"
      },
      {
        productNumberDisplay: "1053091104",
        productNumberHyphen: "105309-1104",
        productNumberSap: "1053091104",
        productStatus: "Active",
        description: "Nano-Fit Vertical Header, Through Hole, 2.50mm Pitch, Dual Row, 4 Circuits"
      },
      {
        productNumberDisplay: "0500588000",
        productNumberHyphen: "50058-8000",
        productNumberSap: "0500588000",
        productStatus: "Active",
        description: "PicoBlade Female Crimp Terminal, 28-32 AWG, Reel"
      }
    ];
    setRawJsonText(JSON.stringify(sample, null, 2));
    setRawJsonError(null);
  };

  const handleAddHeader = () => {
    if (!headerKey.trim()) return;
    onConfigChange({
      ...config,
      customHeaders: {
        ...config.customHeaders,
        [headerKey.trim()]: headerValue.trim(),
      },
    });
    setHeaderKey('');
    setHeaderValue('');
  };

  const handleRemoveHeader = (keyToRemove: string) => {
    const newHeaders = { ...config.customHeaders };
    delete newHeaders[keyToRemove];
    onConfigChange({
      ...config,
      customHeaders: newHeaders,
    });
  };

  const handleToggleStealthMode = () => {
    onConfigChange({
      ...config,
      stealthMode: !config.stealthMode,
    });
  };

  const handleSaveCookie = () => {
    onConfigChange({
      ...config,
      stealthOptions: {
        ...config.stealthOptions,
        customCookies: cookieInput.trim(),
      },
    });
  };

  const handleSaveProxy = () => {
    onConfigChange({
      ...config,
      stealthOptions: {
        ...config.stealthOptions,
        customProxyUrl: proxyUrlInput.trim(),
      },
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Tab Switcher & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50 gap-2">
        <div className="flex items-center space-x-1 bg-slate-200/70 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('urls')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'urls'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 text-rose-700" />
            <span>Molex JSON Links</span>
            {parsedUrlCount > 0 && (
              <span className="ml-1 text-[11px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-mono font-bold">
                {parsedUrlCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'paste'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste Raw JSON</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Quick Sample Presets & Stealth Mode Toggle */}
        <div className="flex items-center space-x-2">
          {/* Stealth Mode Switch */}
          <button
            type="button"
            onClick={handleToggleStealthMode}
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              config.stealthMode
                ? 'bg-rose-50 text-rose-800 border-rose-300 shadow-2xs'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
            }`}
            title="Stealth Mode: Bypasses anti-bot firewalls and CORS by spoofing Chrome 131 headers & dynamic origin"
          >
            <Shield className={`w-3.5 h-3.5 ${config.stealthMode ? 'text-rose-600 fill-rose-100' : 'text-slate-400'}`} />
            <span>Stealth Mode</span>
            <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${config.stealthMode ? 'bg-rose-200/60 text-rose-900' : 'bg-slate-200 text-slate-600'}`}>
              {config.stealthMode ? 'ACTIVE' : 'OFF'}
            </span>
          </button>

          {activeTab === 'urls' && (
            <div className="flex items-center space-x-1.5 text-xs">
              <button
                type="button"
                onClick={loadMolexBatchExample}
                className="px-2.5 py-1 text-xs font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-md transition-colors inline-flex items-center space-x-1"
                title="Insert default Molex batch URLs"
              >
                <span>Insert Default URLs</span>
              </button>
            </div>
          )}

          {activeTab === 'paste' && (
            <button
              type="button"
              onClick={loadRawJsonSample}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors"
            >
              Load Molex Sample JSON
            </button>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
              showSettings
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
            }`}
            title="Configure extraction rules, Stealth options, & headers"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-5">
        {activeTab === 'urls' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="url-textarea" className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-rose-600" />
                <span>Enter Molex Unpublished-Part JSON Link(s)</span>
              </label>
              <span className="text-xs text-slate-400">
                One URL per line (e.g. <code className="font-mono text-[11px] text-slate-600">https://www.molex.com/bin/molex/mulesoft/unpublished-part?partNumber=...</code>)
              </span>
            </div>

            <textarea
              id="url-textarea"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={`https://www.molex.com/bin/molex/mulesoft/unpublished-part?partNumber=855055114\nhttps://www.molex.com/bin/molex/mulesoft/unpublished-part?partNumber=1053091104`}
              rows={4}
              className="w-full font-mono text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-lg p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white resize-y"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                <span className="inline-flex items-center font-semibold text-slate-700">
                  <Check className="w-3.5 h-3.5 text-rose-600 mr-1" />
                  Extracts 4 fields:
                </span>
                <span className="font-mono text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-medium">1. productNumberDisplay</span>
                <span className="font-mono text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-medium">2. productNumberHyphen</span>
                <span className="font-mono text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-medium">3. productNumberSap</span>
                <span className="font-mono text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-medium">4. productStatus</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="inline-flex items-center space-x-1 px-3 py-2 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  title="Paste URLs or JSON directly from clipboard"
                >
                  <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Paste Clipboard</span>
                </button>

                {urlsText && (
                  <button
                    type="button"
                    onClick={() => setUrlsText('')}
                    disabled={isLoading}
                    className="inline-flex items-center space-x-1 px-3 py-2 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStartExtraction}
                  disabled={isLoading || parsedUrlCount === 0}
                  className="inline-flex items-center space-x-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white rounded-lg shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: '#CD3433' }}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Fetching & Extracting Molex Data...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Extract Molex Data {parsedUrlCount > 0 ? `(${parsedUrlCount} Link${parsedUrlCount > 1 ? 's' : ''})` : ''}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'paste' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="json-textarea" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Paste Molex Raw JSON Payload
              </label>
              <span className="text-xs text-slate-400">
                Single object or array of unpublished part objects
              </span>
            </div>

            <textarea
              id="json-textarea"
              value={rawJsonText}
              onChange={(e) => {
                setRawJsonText(e.target.value);
                setRawJsonError(null);
              }}
              placeholder={`{\n  "productNumberDisplay": "855055114",\n  "productNumberHyphen": "85505-5114",\n  "productNumberSap": "0855055114",\n  "productStatus": "Obsolescence"\n}`}
              rows={6}
              className="w-full font-mono text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-lg p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white resize-y"
            />

            {rawJsonError && (
              <div className="mt-2 flex items-center space-x-2 text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>JSON Syntax Error: {rawJsonError}</span>
              </div>
            )}

            <div className="mt-3 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="inline-flex items-center space-x-1 px-3 py-2 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                <span>Paste from Clipboard</span>
              </button>

              <button
                type="button"
                onClick={handleProcessRawJson}
                disabled={isLoading || !rawJsonText.trim()}
                className="inline-flex items-center space-x-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Extract Molex Fields from JSON</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload-input"
            />
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-slate-800 mb-1">
              Upload Molex JSON file or URL list (.txt / .csv)
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Select a <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">.json</code> file to parse directly, or a text file with one Molex unpublished-part URL per line.
            </p>
            <label
              htmlFor="file-upload-input"
              className="inline-flex items-center space-x-2 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer shadow-xs transition-colors"
            >
              <span>Browse Files</span>
            </label>
          </div>
        )}

        {/* Advanced Extraction Settings Drawer */}
        {showSettings && (
          <div className="mt-5 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Settings2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Extraction Engine Settings & Stealth Configuration</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              {/* Column 1: Extraction Rules */}
              <div className="space-y-3">
                <span className="font-semibold text-slate-800 block">Parsing Rules</span>
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.strictMode}
                    onChange={(e) =>
                      onConfigChange({ ...config, strictMode: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="font-medium text-slate-800">Strict Key Matching</span>
                    <p className="text-slate-500 text-[11px] leading-tight">
                      Only match exact keys: <code className="font-mono font-semibold">productNumberDisplay</code>, <code className="font-mono font-semibold">productNumberHyphen</code>, <code className="font-mono font-semibold">productNumberSap</code>, <code className="font-mono font-semibold">productStatus</code>.
                    </p>
                  </div>
                </label>
              </div>

              {/* Column 2: Stealth Mode Engine & Akamai Session */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center space-x-1">
                    <Shield className="w-3.5 h-3.5 text-rose-600" />
                    <span>Stealth & Anti-Bot Bypass</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${config.stealthMode ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-600'}`}>
                    {config.stealthMode ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Emulates browser client hints (Chrome 131), auto-injects target Referer/Origin for molex.com, and circumvents bot heuristics.
                </p>

                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Browser Profile Emulation
                  </label>
                  <select
                    value={config.stealthOptions.browserProfile}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        stealthOptions: {
                          ...config.stealthOptions,
                          browserProfile: e.target.value as any,
                        },
                      })
                    }
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                  >
                    <option value="chrome-131">Google Chrome 131 (Windows 11)</option>
                    <option value="edge-131">Microsoft Edge 131 (Windows 11)</option>
                    <option value="safari-mac">Apple Safari 18 (macOS Sequoia)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Session Cookie (Akamai / Molex Bypass)
                  </label>
                  <div className="flex space-x-1">
                    <input
                      type="text"
                      placeholder="e.g. ak_bmsc=... ; _abck=..."
                      value={cookieInput}
                      onChange={(e) => setCookieInput(e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCookie}
                      className="px-2 py-1 bg-rose-700 text-white rounded text-xs hover:bg-rose-800"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              {/* Column 3: Custom Headers */}
              <div>
                <span className="font-semibold text-slate-800 block mb-1">
                  Custom Request Headers
                </span>
                <p className="text-slate-500 text-[11px] mb-2">
                  Pass custom authorization or custom headers when requesting endpoints.
                </p>

                <div className="flex space-x-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="Authorization"
                    value={headerKey}
                    onChange={(e) => setHeaderKey(e.target.value)}
                    className="w-1/3 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Bearer token123..."
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-medium inline-flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-0.5" />
                    <span>Add</span>
                  </button>
                </div>

                {Object.keys(config.customHeaders).length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {Object.entries(config.customHeaders).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200 text-[11px] font-mono"
                      >
                        <span className="text-slate-700 truncate font-semibold">{k}:</span>
                        <span className="text-slate-500 truncate mx-1 max-w-[110px]">{v}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(k)}
                          className="text-slate-400 hover:text-red-500 ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
