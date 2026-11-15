// Camera, sol and NASA image ID for each rover photo in app/public/photos/.
// Same facts as the "Rover photos" table in docs/sources.md: keep the two in step.
// Every image is credited "NASA/JPL-Caltech" by NASA's Mars 2020 raw image gallery.

export type PhotoCredit = {
  camera: string;
  /** Mission sol the image was taken on. */
  sol: number;
  /** NASA raw image ID. */
  imageId: string;
  /** NASA raw image gallery page for this image. */
  sourceUrl: string;
};

const GALLERY = "https://mars.nasa.gov/mars2020/multimedia/raw-images/";
const credit = (camera: string, sol: number, imageId: string): PhotoCredit => ({
  camera,
  sol,
  imageId,
  sourceUrl: GALLERY + imageId,
});

const HAZCAM = "Front Left Hazcam";

/** Keyed by the POI's `photo` path in site.json. */
export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
  "photos/seitah-brac.jpg": credit(HAZCAM, 262, "FLF_0262_0690210688_738ECM_N0080000FHAZ00206_01_295J"),
  "photos/maaz-sid.jpg": credit(HAZCAM, 371, "FLF_0371_0699884867_862ECM_N0110108FHAZ00206_01_295J"),
  "photos/maaz-rochette.jpg": credit("Left Navcam", 190, "NLF_0190_0683808901_487ECM_N0070000NCAM00209_01_295J"),
  "photos/seitah-issole.jpg": credit(HAZCAM, 337, "FLF_0337_0696864692_347ECM_N0090276FHAZ00206_01_295J"),
  "photos/delta-wildcat-ridge.jpg": credit(HAZCAM, 509, "FLF_0509_0712138514_736ECM_N0261222FHAZ00206_01_295J"),
  "photos/delta-amalik.jpg": credit(HAZCAM, 575, "FLF_0575_0717995745_942ECM_N0290000FHAZ00206_01_295J"),
  "photos/delta-hidden-harbor.jpg": credit(HAZCAM, 623, "FLF_0623_0722254512_006ECM_N0301172FHAZ00216_01_295J"),
};

/** Camera and sol for a photo path, or undefined if we have no record of it. */
export function photoCreditFor(photo: string | undefined): PhotoCredit | undefined {
  return photo ? PHOTO_CREDITS[photo.replace(/^\//, "")] : undefined;
}
