export class SlotAllocator {
  private readonly freeList: number[] = [];
  private nextSlot = 0;

  constructor(private readonly capacity: number) {}

  allocate(): number | null {
    const fromFree = this.freeList.pop();
    if (fromFree !== undefined) return fromFree;

    if (this.nextSlot >= this.capacity) return null;
    const slot = this.nextSlot;
    this.nextSlot += 1;
    return slot;
  }

  free(slot: number): void {
    if (!Number.isFinite(slot)) return;
    if (slot < 0 || slot >= this.capacity) return;
    this.freeList.push(slot);
  }
}
