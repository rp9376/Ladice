#include "Graphics.h"
#include <SDL2/SDL_image.h>
#include "Game.h"


Graphics::Graphics()
{

}

Graphics::~Graphics()
{
    //dtor
}

SDL_Texture *Graphics::loadTexture(const char* fileName, SDL_Renderer* renderer)
{
	SDL_Surface* tmpSurface = IMG_Load(fileName);
	SDL_Texture* texture = SDL_CreateTextureFromSurface(renderer, tmpSurface);

	SDL_FreeSurface(tmpSurface);

	return texture;
}






