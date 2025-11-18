
import { GlobalWorkerOptions } from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.mjs?url";
GlobalWorkerOptions.workerSrc = worker;
export default worker;
