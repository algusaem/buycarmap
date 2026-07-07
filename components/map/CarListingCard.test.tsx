import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { CarListing } from "@/interfaces/listing";
import { CarListingCard } from "./CarListingCard";

// next/image needs the Next runtime; a plain img is enough for behaviour tests.
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const listing: CarListing = {
  id: "wallapop-1",
  image: "https://cdn.example.com/car.jpg",
  title: "Audi A3 2.0 TDI",
  subtitle: "Great condition",
  price: 14500,
  mileage: 95000,
  year: 2018,
  fuel: "gasoil",
  brand: "Audi",
  model: "A3",
  location: "Madrid",
  source: "Wallapop",
  lat: 40.4,
  lng: -3.7,
  url: "https://es.wallapop.com/item/audi-a3-1",
};

describe("CarListingCard", () => {
  it("renders the title, locale-formatted price, and links out to the source", () => {
    render(<CarListingCard {...listing} />);

    expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    // es-ES thousands separator is a dot.
    expect(screen.getByText(/14\.500/)).toBeInTheDocument();

    const [link] = screen.getAllByRole("link");
    expect(link).toHaveAttribute("href", listing.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the fallback icon instead of an image when there is no image", () => {
    render(<CarListingCard {...listing} image="" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("toggles the favorite accessible label on click", async () => {
    render(<CarListingCard {...listing} />);
    const button = screen.getByRole("button");
    const initialLabel = button.getAttribute("aria-label");

    await userEvent.click(button);

    expect(button.getAttribute("aria-label")).not.toBe(initialLabel);
  });

  it("omits year and mileage separators when those fields are empty", () => {
    render(<CarListingCard {...listing} year={0} mileage={0} />);
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<CarListingCard {...listing} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
