import { parseNullableMarketNumber as number } from "../../utils/marketNumbers";
export const price = value => number(value) === null ? "—" : number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const currency = value => number(value) === null ? "—" : `${number(value) < 0 ? "−" : ""}$${price(Math.abs(number(value)))}`;
export const signed = value => number(value) === null ? "—" : `${number(value) >= 0 ? "+" : ""}${price(value)}`;
export const valueClass = value => number(value) === null || number(value) === 0 ? "" : number(value) < 0 ? "ws-negative" : "ws-positive";
