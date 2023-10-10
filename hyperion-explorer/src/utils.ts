async function imageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function checkLinksForValidMedia(links: string[]) : Promise<string | null> {
    let resultUrl: string = null;

    const results: boolean[] = await Promise.all(
        links.map(link => imageExists(link)));

    const foundIndex = results.indexOf(true);
    if (foundIndex != -1)
        resultUrl = links[foundIndex];

    return resultUrl;
}
