import { DiagnosticType } from '../models/DiagnosticType';

export enum AnnotationType {
    DIAGNOSTIC_OFF = 'diagnostic-off',
    SOFT_OVERRIDE = 'soft-override',
}

export const annotationPattern = /(?:^|\s+|\/)\*@(?<type>[\w-]+)(?::(?<value>[\w,]+))?\s*(?:$|\*\/)/gm

export interface Annotations {
    sourceFile: string;
    startIndex: number;
    endIndex: number;
    startLine: number;
    endLine: number;
    annotations: {
        diagnosticsOff: DiagnosticType[];
        softOverride: boolean;
    }
}
