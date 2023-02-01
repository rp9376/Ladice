#ifndef GRAPHICS_H
#define GRAPHICS_H

#include "Game.h"

class Graphics
{
    public:
        Graphics();
        ~Graphics();

        SDL_Texture *loadTexture(const char* fileName, SDL_Renderer* renderer);




    private:


};

#endif // GRAPHICS_H
