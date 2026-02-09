// app/components/PDFCalibrator.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';

// CORRECCIÓN: Configuración del worker
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url,
  ).toString();
}

interface Coordinate {
  x: number;
  y: number;
}

export default function PDFCalibrator() {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [selectedField, setSelectedField] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('/consentimientos/FO-HCR-21.pdf');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Cargar PDF.js worker dinámicamente
  useEffect(() => {
    const loadPdfWorker = async () => {
      try {
        // Cargar el worker solo en el cliente
        if (typeof window !== 'undefined') {
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        }
      } catch (error) {
        console.error('Error loading PDF worker:', error);
      }
    };
    
    loadPdfWorker();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setCoordinates([]); // Limpiar coordenadas al cambiar PDF
    }
  };

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setIsLoading(false);
  };

  const handleDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setIsLoading(false);
    alert('Error al cargar el PDF. Verifica que el archivo sea válido.');
  };

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !pageRef.current) return;

    // Obtener las coordenadas relativas al contenedor del PDF
    const containerRect = containerRef.current.getBoundingClientRect();
    const pageRect = pageRef.current.getBoundingClientRect();
    
    // Calcular coordenadas relativas a la página
    const x = e.clientX - pageRect.left;
    const y = e.clientY - pageRect.top;
    
    // Convertir a puntos PDF (72 puntos por pulgada)
    const pdfX = (x / pageRect.width) * 612; // Ancho estándar de página PDF (8.5" * 72)
    const pdfY = (1 - (y / pageRect.height)) * 792; // Alto estándar (11" * 72), invertir Y
    
    const newCoord = { x: Math.round(pdfX), y: Math.round(pdfY) };
    setCoordinates([...coordinates, newCoord]);
    
    console.log('Coordenadas PDF:', newCoord);
    console.log('Coordenadas pantalla:', { x: Math.round(x), y: Math.round(y) });
    console.log('Para configurar en código:', 
      `${selectedField || 'campo'}: { x: ${newCoord.x}, y: ${newCoord.y} },`
    );
  };

  const copyAllCoordinates = () => {
    const config = coordinates.map((coord, i) => 
      `campo${i + 1}: { x: ${coord.x}, y: ${coord.y} },`
    ).join('\n');
    
    navigator.clipboard.writeText(config);
    alert('Coordenadas copiadas al portapapeles!');
  };

  const clearCoordinates = () => {
    setCoordinates([]);
  };

  // Alternativa: método simplificado sin react-pdf
  const handleUseSimpleCalibrator = () => {
    // Redirige a una versión HTML simple
    window.open('/calibrador-simple.html', '_blank');
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Calibrador de Coordenadas PDF</h1>
      
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="border p-2 rounded flex-1 min-w-[200px]"
          />
          
          <input
            type="text"
            placeholder="Nombre del campo (opcional)"
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="border p-2 rounded"
          />
          
          <select 
            value={scale} 
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="border p-2 rounded"
          >
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1.0">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2.0">200%</option>
          </select>
          
          <div className="flex gap-2">
            <button
              onClick={clearCoordinates}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Limpiar
            </button>
            
            <button
              onClick={copyAllCoordinates}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Copiar Todas
            </button>

            <button
              onClick={handleUseSimpleCalibrator}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Usar Calibrador Simple
            </button>
          </div>
        </div>
        
        <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded">
          <p className="font-bold">Instrucciones:</p>
          <p>1. Selecciona tu PDF o usa el predeterminado</p>
          <p>2. Haz clic en cada campo donde quieres colocar texto/firma</p>
          <p>3. Las coordenadas aparecerán abajo (en puntos PDF)</p>
          <p className="mt-2 text-red-600">
            Si hay problemas con el visor, usa el botón "Usar Calibrador Simple"
          </p>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Panel del PDF */}
        <div className="flex-1">
          <div 
            ref={containerRef}
            className="border rounded-lg overflow-auto bg-gray-100"
            style={{ height: '70vh' }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-4">Cargando PDF...</p>
                </div>
              </div>
            ) : (
              <Document
                file={pdfUrl}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading={<div className="p-8">Cargando PDF...</div>}
              >
                <div 
                  ref={pageRef}
                  onClick={handlePageClick}
                  className="cursor-crosshair relative"
                  style={{ position: 'relative' }}
                >
                  <Page 
                    pageNumber={pageNumber} 
                    scale={scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="border"
                  />
                  
                  {/* Marcadores de coordenadas */}
                  {coordinates.map((coord, index) => (
                    <div
                      key={index}
                      style={{
                        position: 'absolute',
                        left: `${(coord.x / 612) * 100}%`,
                        top: `${(1 - (coord.y / 792)) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '20px',
                        height: '20px',
                        backgroundColor: 'red',
                        borderRadius: '50%',
                        border: '2px solid white',
                        pointerEvents: 'none',
                      }}
                    >
                      <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-white px-1 rounded">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </Document>
            )}
            
            {numPages > 1 && (
              <div className="p-4 flex justify-center gap-2">
                <button
                  onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                  disabled={pageNumber <= 1}
                  className="bg-gray-200 px-4 py-2 rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="px-4 py-2">
                  Página {pageNumber} de {numPages}
                </span>
                <button
                  onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                  disabled={pageNumber >= numPages}
                  className="bg-gray-200 px-4 py-2 rounded disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Panel de coordenadas */}
        <div className="w-full lg:w-96">
          <h2 className="text-xl font-bold mb-4">Coordenadas Capturadas</h2>
          
          <div className="bg-gray-50 p-4 rounded-lg h-64 overflow-auto mb-4">
            {coordinates.length === 0 ? (
              <p className="text-gray-500">Haz clic en el PDF para capturar coordenadas</p>
            ) : (
              <ul className="space-y-2">
                {coordinates.map((coord, index) => (
                  <li key={index} className="p-2 bg-white rounded border">
                    <span className="font-bold">Punto {index + 1}:</span>{' '}
                    x: {coord.x}, y: {coord.y}
                    <br />
                    <code className="text-sm text-gray-600">
                      {selectedField || `campo${index + 1}`}: &#123; x: {coord.x}, y: {coord.y} &#125;,
                    </code>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-bold mb-2">Configuración para tu código:</h3>
            <pre className="text-sm bg-white p-3 rounded overflow-auto max-h-40">
              {`"FO-HCR-21": {
  templatePublicPath: "consentimientos/FO-HCR-21.pdf",
  page1: {
    dia: { x: ${coordinates[0]?.x || 0}, y: ${coordinates[0]?.y || 0} },
    mes: { x: ${coordinates[1]?.x || 0}, y: ${coordinates[1]?.y || 0} },
    anio: { x: ${coordinates[2]?.x || 0}, y: ${coordinates[2]?.y || 0} },
    // ... continúa con las demás coordenadas
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}