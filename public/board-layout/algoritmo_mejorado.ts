export type Direccion = "DERECHA" | "IZQUIERDA";

export interface Extremo {
	valor: number;
	fila: number;
	columna: number;
	direccion: Direccion;
}

export interface Ficha {
	ladoA: number;
	ladoB: number;
	id: string;
}

export class MotorTableroDomino {
	private ANCHO_TABLERO = 16;
	public tablero: Record<number, (number | null)[]>;
	public extremosAbiertos: Extremo[];
	private fichasJugadas: Set<string>;

	constructor() {
		this.tablero = {};
		this.extremosAbiertos = [];
		this.fichasJugadas = new Set();
		this.inicializarFila(0);
	}

	private inicializarFila(numFila: number) {
		if (!this.tablero[numFila]) {
			this.tablero[numFila] = Array(this.ANCHO_TABLERO).fill(null);
		}
	}

	private obtenerDireccionFila(numFila: number): Direccion {
		return Math.abs(numFila) % 2 === 0 ? "DERECHA" : "IZQUIERDA";
	}

	private calcularEspacioLibre(
		fila: number,
		columna: number,
		dir: Direccion,
	): number {
		if (dir === "DERECHA") {
			return this.ANCHO_TABLERO - 1 - columna;
		} else {
			return columna;
		}
	}

	private obtenerSiguienteColumna(columna: number, dir: Direccion): number {
		return dir === "DERECHA" ? columna + 1 : columna - 1;
	}

	private obtenerSiguienteFilaVacia(filaActual: number): number {
		if (filaActual >= 0) {
			let f = filaActual + 1;
			while (this.tablero[f]?.some((celda) => celda !== null)) f++;
			this.inicializarFila(f);
			return f;
		} else {
			let f = filaActual - 1;
			while (this.tablero[f]?.some((celda) => celda !== null)) f--;
			this.inicializarFila(f);
			return f;
		}
	}

	public colocarFicha(ficha: Ficha, extremoIndice: number): boolean {
		const { ladoA, ladoB, id } = ficha;
		if (this.fichasJugadas.has(id)) return false;

		const extremo = this.extremosAbiertos[extremoIndice];
		if (!extremo || (extremo.valor !== ladoA && extremo.valor !== ladoB))
			return false;

		const valorConexion = extremo.valor === ladoA ? ladoA : ladoB;
		const valorLibre = valorConexion === ladoA ? ladoB : ladoA;

		const filaAct = extremo.fila;
		const colAct = extremo.columna;
		const dirAct = extremo.direccion;

		this.inicializarFila(filaAct);
		const espacio = this.calcularEspacioLibre(filaAct, colAct, dirAct);
		const esDoble = ladoA === ladoB;

		if (esDoble) {
			if (espacio === 0) {
				const nuevaFila = this.obtenerSiguienteFilaVacia(filaAct);
				this.tablero[nuevaFila][colAct] = valorConexion;
				this.extremosAbiertos[extremoIndice] = {
					valor: valorLibre,
					fila: nuevaFila,
					columna: colAct,
					direccion: dirAct === "DERECHA" ? "IZQUIERDA" : "DERECHA",
				};
			} else {
				const colSig = this.obtenerSiguienteColumna(colAct, dirAct);
				this.tablero[filaAct][colSig] = valorConexion;
				this.extremosAbiertos[extremoIndice] = {
					valor: valorLibre,
					fila: filaAct,
					columna: colSig,
					direccion: dirAct,
				};
			}
		} else {
			if (espacio >= 2) {
				const c1 = this.obtenerSiguienteColumna(colAct, dirAct);
				const c2 = this.obtenerSiguienteColumna(c1, dirAct);
				this.tablero[filaAct][c1] = valorConexion;
				this.tablero[filaAct][c2] = valorLibre;
				this.extremosAbiertos[extremoIndice] = {
					valor: valorLibre,
					fila: filaAct,
					columna: c2,
					direccion: dirAct,
				};
			} else if (espacio === 1) {
				const colBorde = this.obtenerSiguienteColumna(colAct, dirAct);
				const nuevaFila = this.obtenerSiguienteFilaVacia(filaAct);
				this.tablero[filaAct][colBorde] = valorConexion;
				this.tablero[nuevaFila][colBorde] = valorLibre;
				this.extremosAbiertos[extremoIndice] = {
					valor: valorLibre,
					fila: nuevaFila,
					columna: colBorde,
					direccion: this.obtenerDireccionFila(nuevaFila),
				};
			} else if (espacio === 0) {
				const nuevaFila = this.obtenerSiguienteFilaVacia(filaAct);
				this.tablero[nuevaFila][colAct] = valorLibre;
				this.extremosAbiertos[extremoIndice] = {
					valor: valorLibre,
					fila: nuevaFila,
					columna: colAct,
					direccion: this.obtenerDireccionFila(nuevaFila),
				};
			}
		}

		this.fichasJugadas.add(id);
		return true;
	}
}
