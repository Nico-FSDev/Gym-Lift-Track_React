import React, { useState, useRef, useEffect } from 'react';
import { Upload, Database, CheckCircle2, AlertCircle, FileSpreadsheet, Clipboard, RefreshCw, HelpCircle } from 'lucide-react';
import { backButtonManager } from '../utils/backButtonManager';

interface CsvImporterProps {
  onImport: (csvText: string) => Promise<{ success: boolean; setsCount: number; configsCount: number }>;
  onClose?: () => void;
}

export default function CsvImporter({ onImport, onClose }: CsvImporterProps) {
  const [csvInput, setCsvInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ setsCount: number; configsCount: number } | null>(null);
  const [showPasteMobile, setShowPasteMobile] = useState(false);

  useEffect(() => {
    if (!onClose) return;
    return backButtonManager.register('csv-importer-modal', 90, () => {
      onClose();
      return true;
    });
  }, [onClose]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError(null);
    setSuccessResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setError('Le fichier est vide.');
        return;
      }
      setCsvInput(text);
      await handleImportSubmit(text);
    };
    reader.onerror = () => {
      setError('Erreur lors de la lecture du fichier.');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setError(null);
    setSuccessResult(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessResult(null);

    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = async (textToImport: string) => {
    const rawData = textToImport || csvInput;
    if (!rawData.trim()) {
      setError('Veuillez glisser un fichier ou coller des données CSV/TSV.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await onImport(rawData);
      if (res.success) {
        setSuccessResult({
          setsCount: res.setsCount,
          configsCount: res.configsCount
        });
        setCsvInput('');
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du traitement de votre fichier. Vérifiez le format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="csv-importer-container" className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-md max-w-xl mx-auto space-y-6 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center text-green-600 dark:text-green-400">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Importateur Google Sheets & CSV</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Prend en charge votre nouveau format de colonnes</p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="text-gray-400 dark:text-slate-500 hover:text-black dark:hover:text-white text-sm font-semibold transition-colors px-3 py-1 bg-gray-50 dark:bg-slate-800/40 rounded-lg"
          >
            Fermer
          </button>
        )}
      </div>

      {successResult ? (
        <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-2xl p-5 space-y-4 text-center animate-in zoom-in-95 duration-200">
          <div className="flex justify-center text-green-500">
            <CheckCircle2 size={42} />
          </div>
          <div>
            <h4 className="font-bold text-green-800 dark:text-green-400 text-lg">Importation réussie !</h4>
            <p className="text-sm font-medium text-green-700/80 dark:text-green-500/80 mt-1">
              Vos entraînements ont été parfaits et synchronisés avec Firestore.
            </p>
          </div>
          <div className="flex justify-center gap-6 py-2 bg-white dark:bg-slate-900/40 rounded-xl border border-green-100 dark:border-green-950 max-w-xs mx-auto">
            <div>
              <span className="block text-2xl font-black text-gray-900 dark:text-white">{successResult.configsCount}</span>
              <span className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Machines / Exercices</span>
            </div>
            <div className="border-r border-gray-100 dark:border-slate-800 my-1" />
            <div>
              <span className="block text-2xl font-black text-gray-900 dark:text-white">{successResult.setsCount}</span>
              <span className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Séries Loggées</span>
            </div>
          </div>
          <button 
            onClick={() => setSuccessResult(null)}
            className="mt-2 text-xs font-bold text-green-700 dark:text-green-400 hover:underline flex items-center justify-center gap-1.5 mx-auto"
          >
            <RefreshCw size={14} /> Importer un autre fichier
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Instructions Block */}
          <div className="bg-gray-50 dark:bg-slate-800/30 rounded-2xl p-4 border border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-slate-300">
              <HelpCircle size={14} />
              <span>Comment faire ?</span>
            </div>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Dans Google Sheets, sélectionnez vos colonnes (ex: de <span className="font-semibold text-gray-800 dark:text-slate-300">A à AG</span>) et copiez-les (<kbd className="bg-white dark:bg-slate-800 px-1 border border-gray-200 dark:border-slate-700 rounded shadow-2xs font-sans">Ctrl+C</kbd> ou <kbd className="bg-white dark:bg-slate-800 px-1 border border-gray-200 dark:border-slate-700 rounded shadow-2xs font-sans">⌘+C</kbd>).</li>
              <li>Utilisez l'option <strong>Copier-coller</strong> ci-dessous et collez le contenu, ou exportez sous format CSV/TSV et glissez-déposez le fichier ici.</li>
              <li>Le premier en-tête doit identifier les machines avec <code className="bg-white dark:bg-slate-800 px-1 border border-gray-200 dark:border-slate-700 rounded text-red-500 font-mono">MACHINE [Nom]</code> ou <code className="bg-white dark:bg-slate-800 px-1 border border-gray-200 dark:border-slate-700 rounded text-teal-500 font-mono">EXERCISE [Nom]</code>.</li>
            </ol>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex gap-3 text-red-700 dark:text-red-400 animate-in fade-in duration-300 text-xs font-semibold">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 gap-3 min-h-[160px] active:scale-98 ${
              isDragOver
                ? 'border-black dark:border-white bg-gray-50 dark:bg-slate-800/50'
                : 'border-gray-200 dark:border-slate-800 hover:border-black dark:hover:border-white hover:bg-gray-50/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-slate-400">
              <Upload size={24} className={loading ? 'animate-bounce' : ''} />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">
                Glissez-déposez votre fichier CSV/TSV ici
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 font-medium">
                Ou cliquez pour parcourir vos fichiers (.csv, .tsv)
              </p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowPasteMobile(!showPasteMobile)}
              className="text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white flex items-center justify-center gap-1 mx-auto py-1 px-3 border border-gray-100 dark:border-slate-800 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Clipboard size={14} /> {showPasteMobile ? 'Masquer le copier-coller' : 'Copier-coller du texte brut'}
            </button>
          </div>

          {/* Text Area copy paste option */}
          {(showPasteMobile || csvInput.length > 0) && (
            <div className="space-y-3 animate-in slide-in-from-top-3 duration-250">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-400">
                Coller les données copiées de Google Sheet :
              </label>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="MACHINE	Arm Curl			MACHINE	Abdominal...&#10;Date	rep	weight lbs	weight kg	Date	rep...&#10;07/06/2026	6	100	45	07/06/2026	10..."
                className="w-full h-44 bg-gray-50 dark:bg-slate-950 p-4 border border-gray-200 dark:border-slate-800 rounded-2xl font-mono text-xs text-gray-800 dark:text-slate-100 placeholder-gray-300 dark:placeholder-slate-700 focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
              />
              <button
                disabled={loading || !csvInput.trim()}
                onClick={() => handleImportSubmit(csvInput)}
                className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black font-bold text-sm rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-transform flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Database size={16} />
                    <span>Lancer l'importation de données 🚀</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
