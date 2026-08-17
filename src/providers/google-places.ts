import "server-only";

import { getEnv } from "@/env";

export type GooglePlace = {
  id: string;
  displayName: string;
  formattedAddress: string;
  types: string[];
  website: string;
  nationalPhoneNumber: string;
  internationalPhoneNumber: string;
  googleMapsUri: string;
  latitude: number | null;
  longitude: number | null;
};

type GooglePlacePayload = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  types?: string[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
  viewport?: {
    low?: { latitude?: number; longitude?: number };
    high?: { latitude?: number; longitude?: number };
  };
};

type GoogleSearchResponse = {
  places?: GooglePlacePayload[];
  nextPageToken?: string;
};

export type TerritorySearchArea = {
  latitude: number;
  longitude: number;
  radiusM: number;
  requestMeta?: GoogleRequestMeta;
};

export type GoogleRequestMeta = {
  status: number;
  durationMs: number;
  requestId: string;
};

const PLACE_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.types",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.googleMapsUri",
  "places.location",
].join(",");

function mapPlaces(data: GoogleSearchResponse): GooglePlace[] {
  return (data.places ?? [])
    .filter((place): place is GooglePlacePayload & { id: string } => Boolean(place.id))
    .map((place) => ({
      id: place.id,
      displayName: place.displayName?.text ?? "Unknown business",
      formattedAddress: place.formattedAddress ?? "",
      types: place.types ?? [],
      website: place.websiteUri ?? "",
      nationalPhoneNumber: place.nationalPhoneNumber ?? "",
      internationalPhoneNumber: place.internationalPhoneNumber ?? "",
      googleMapsUri: place.googleMapsUri ?? "",
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
    }));
}

function viewportRadius(place: GooglePlacePayload): number {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  const low = place.viewport?.low;
  const high = place.viewport?.high;
  if (latitude == null || longitude == null || !low || !high) return 15_000;

  const latitudeM = Math.max(Math.abs(latitude - low.latitude!), Math.abs(high.latitude! - latitude)) * 111_320;
  const longitudeM = Math.max(Math.abs(longitude - low.longitude!), Math.abs(high.longitude! - longitude))
    * 111_320
    * Math.cos((latitude * Math.PI) / 180);
  return Math.min(50_000, Math.max(3_000, Math.ceil(Math.hypot(latitudeM, longitudeM))));
}

class GooglePlacesProvider {
  isConfigured() {
    return Boolean(getEnv().GOOGLE_PLACES_API_KEY);
  }

  private async post(path: string, body: Record<string, unknown>, fieldMask: string) {
    const apiKey = getEnv().GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    const startedAt = Date.now();
    const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });
    const meta: GoogleRequestMeta = {
      status: response.status,
      durationMs: Date.now() - startedAt,
      requestId: response.headers.get("x-google-request-id")
        ?? response.headers.get("x-request-id")
        ?? response.headers.get("x-guploader-uploadid")
        ?? "",
    };
    if (!response.ok) {
      throw new Error(`Google Places request failed (${response.status}, request ${meta.requestId || "unavailable"}): ${await response.text()}`);
    }
    return { data: await response.json() as GoogleSearchResponse, meta };
  }

  async searchText(query: string, pageToken?: string) {
    const { data, meta } = await this.post("places:searchText", {
      textQuery: query,
      pageSize: 20,
      languageCode: "en",
      ...(pageToken ? { pageToken } : {}),
    }, `${PLACE_FIELDS},nextPageToken`);
    return { places: mapPlaces(data), nextPageToken: data.nextPageToken ?? null, meta };
  }

  async searchNearby(area: TerritorySearchArea) {
    const { data, meta } = await this.post("places:searchNearby", {
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      locationRestriction: {
        circle: {
          center: { latitude: area.latitude, longitude: area.longitude },
          radius: Math.min(50_000, Math.max(1_000, area.radiusM)),
        },
      },
    }, PLACE_FIELDS);
    return { places: mapPlaces(data), meta };
  }

  async resolveTerritory(town: string, country: string): Promise<TerritorySearchArea> {
    const { data, meta } = await this.post("places:searchText", {
      textQuery: `${town}, ${country}`,
      pageSize: 1,
      languageCode: "en",
    }, "places.location,places.viewport");
    const place = data.places?.[0];
    const latitude = place?.location?.latitude;
    const longitude = place?.location?.longitude;
    if (latitude == null || longitude == null) {
      throw new Error(`Google Places could not locate ${town}, ${country}.`);
    }
    return { latitude, longitude, radiusM: viewportRadius(place ?? {}), requestMeta: meta };
  }
}

export const googlePlaces = new GooglePlacesProvider();
