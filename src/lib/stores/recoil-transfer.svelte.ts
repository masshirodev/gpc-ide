export interface RecoilTransfer {
    weaponName: string;
    weaponIndex: number;
    values: number[];          // 20 values [V0,H0,V1,H1,...,V9,H9]
    returnTo: string | null;   // file path to write back to
}

let transfer = $state<RecoilTransfer | null>(null);

export function getRecoilTransfer(): RecoilTransfer | null {
    return transfer;
}

export function setRecoilTransfer(data: RecoilTransfer): void {
    transfer = data;
}

export function clearRecoilTransfer(): void {
    transfer = null;
}
