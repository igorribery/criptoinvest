export type SparklineProps = {
    data: number[];
    width?: number;
    height?: number;
    className?: string;
    /** Se positivo, linha verde; negativo, vermelha */
    positive?: boolean;
    /** ID único para gradientes (evita conflito com múltiplos sparklines) */
    id?: string;
  };