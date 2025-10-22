// @ts-nocheck
declare var pdfjsLib: any;

// Fix: Imported GeminiInvoiceData from types.ts where it has been centralized.
import type { InvoiceData, GeminiInvoiceData } from '../types';

/**
 * Initiates the asynchronous processing of an invoice file.
 * @param file The invoice file (image or PDF) to process.
 * @returns A promise that resolves to an object containing the job ID.
 */
export const startInvoiceProcessing = async (file: File): Promise<{ jobId: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/procesar-factura', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            throw new Error(errorData.error || 'Server responded with an error.');
        }

        return await response.json();
    } catch (error) {
        console.error("Error starting invoice processing:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`Could not start processing for ${file.name}. Reason: ${message}`);
    }
};

/**
 * Checks the status of a processing job.
 * @param jobId The ID of the job to check.
 * @returns A promise that resolves to the current status object of the job.
 */
export const checkJobStatus = async (jobId: string): Promise<any> => {
    try {
        const response = await fetch(`/api/verificar-estado?jobId=${jobId}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            throw new Error(errorData.error || 'Server responded with an error.');
        }

        return await response.json();
    } catch (error) {
        console.error(`Error checking status for job ${jobId}:`, error);
        // Return a failed status so the polling logic can handle it
        return { status: 'failed', error: error.message };
    }
};


/*
// The original synchronous function is no longer used by the frontend.
// It is replaced by startInvoiceProcessing and checkJobStatus.

const sanitizePdf = async (file: File): Promise<File> => {
    console.log("Sanitizing PDF:", file.name);
    try {
        const arrayBuffer = await file.arrayBuffer();
        const typedarray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const page = await pdf.getPage(1); // Get the first page

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error("Could not get canvas context.");
        }

        // Render at a high resolution for good OCR quality
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.95); // High quality jpeg
        });

        if (!blob) {
            throw new Error("Failed to convert canvas to blob.");
        }

        const sanitizedFile = new File([blob], `sanitized_${file.name.replace(/\.pdf$/i, '.jpg')}`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });

        console.log("Sanitization successful, new file:", sanitizedFile.name);
        return sanitizedFile;

    } catch (error) {
        console.error("PDF sanitization failed, uploading original file as fallback.", error);
        // If sanitization fails (e.g., corrupted PDF), return the original file and let the backend try.
        return file;
    }
};

export const extractInvoiceData = async (source: File | string): Promise<GeminiInvoiceData> => {
    const basePrompt = `
        Analiza los datos de esta factura o remito. Extrae la siguiente información y devuélvela estrictamente en formato JSON según el schema proporcionado.
        - Número de Factura/Comprobante
        - Fecha de la Factura (formato YYYY-MM-DD)
        - Nombre o Razón Social del emisor
        - CUIT del emisor
        - Importe Total
        - Percepciones de IVA e Ingresos Brutos (si están presentes)
        - Lista detallada de todos los ítems, con su cantidad, descripción, precio unitario e importe total.
        Si un campo opcional como una percepción no se encuentra, su valor debe ser null.
    `;

    const formData = new FormData();
    formData.append('prompt', basePrompt);

    if (typeof source === 'string') {
        formData.append('sourceIsText', 'true');
        formData.append('textContent', source);
    } else {
        let fileToUpload = source;
        if (source.type === 'application/pdf') {
            fileToUpload = await sanitizePdf(source);
        }
        formData.append('file', fileToUpload);
    }

    try {
        const response = await fetch('/api/procesar-factura', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from server.' }));
            throw new Error(errorData.error || 'Respuesta no exitosa del servidor.');
        }

        const parsedData = await response.json();
        
        if (!parsedData || !parsedData.invoiceNumber || !Array.isArray(parsedData.items)) {
            throw new Error("La IA devolvió una estructura de datos inválida o incompleta.");
        }

        return parsedData as GeminiInvoiceData;

    } catch (error) {
        console.error("Error calling backend proxy:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`No se pudo procesar el documento. Razón: ${message}`);
    }
};
*/