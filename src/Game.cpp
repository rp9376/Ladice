#include <iostream>
#include <cstdlib>     //system("clear");
#include <time.h>
#include <stdio.h>
#include <math.h>
#include <string>
#include <fstream>
#include <iomanip>
#include <SDL2/SDL.h>
#include <SDL2/SDL_image.h>
#include <SDL2/SDL_mixer.h>

#include "Game.h"
#include "Graphics.h"
#include "obsticale.h"
#include "enemy.h"
#include "friendly.h"

Game::Game()
{
    init();

    menu();

    killme();
}
Game::~Game() {}

void Game::init()
{

    //Initialize SDL
    if( SDL_Init( SDL_INIT_EVERYTHING ) < 0 )
    {
        printf( "SDL could not initialize! SDL_Error: %s\n", SDL_GetError() );
        killme();
    }
     else
    {
        //Create window
        window = SDL_CreateWindow( "Ladice", SDL_WINDOWPOS_UNDEFINED, SDL_WINDOWPOS_UNDEFINED, SCREEN_WIDTH, SCREEN_HEIGHT, SDL_WINDOW_SHOWN );

        if( window == NULL )
        {
            printf( "Window could not be created! SDL_Error: %s\n", SDL_GetError() );
            exit(1);
        }

         //Initialize PNG loading
            int imgFlags = IMG_INIT_PNG;
            if( !( IMG_Init( imgFlags ) & imgFlags ) )
            {
                printf( "SDL_image could not initialize! SDL_image Error: %s\n", IMG_GetError() );
            }


        //Initialize SDL_mixer
        if( Mix_OpenAudio( 22050, MIX_DEFAULT_FORMAT, 2, 4096 ) == -1 )
        {
            printf( "SDl_Mixer init failed SDL_Error: %s\n", SDL_GetError() );
            audioEnabled = false;
        }


        /*
        else
        {
            //Get window surface
            screenSurface = SDL_GetWindowSurface( window );

            //Fill the surface white
            SDL_FillRect( screenSurface, NULL, SDL_MapRGB( screenSurface->format, 0x00, 0x00, 0x00 ) );

            //Update the surface
            SDL_UpdateWindowSurface( window );
        }
        */

        //renderer init
        renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_ACCELERATED);
        if (renderer == NULL)
        {
             std::cout << "Hardware Init Failed: " << SDL_GetError() << std::endl;
             std::cout << "Falling back to software renderer..." << std::endl;
             renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_SOFTWARE);
        }

        if (renderer == NULL)
            {
                std::cout<<"Renderer creation error: " << SDL_GetError() << std::endl;
                killme();
            }
        SDL_SetRenderDrawColor(renderer, 0xff, 0xff, 0xff, 0xff);
    }
}

void Game::killme()
{
    //Destroy window
    SDL_DestroyWindow( window );
    SDL_DestroyRenderer(renderer);

    //Quit SDL subsystems
    IMG_Quit();
    SDL_Quit();
    exit(0);
}

int Game::menu()
{
    SDL_Surface *menuSurface = NULL;
    SDL_Surface *imageSurface = NULL;
    //SDL_Surface *black = NULL;
    Mix_Music *music = NULL;
    Mix_Music *musicHax = NULL;


    // Use Renderer for Menu
    SDL_Texture* menuTexture = IMG_LoadTexture(renderer, "assets/Boat.bmp");
    if(menuTexture == NULL)
    {
        std::cout<< "SDL could not load Boat image! " << SDL_GetError()<<std::endl;
    }

    music = Mix_LoadMUS( "assets/MenuSound.wav" );
    musicHax = Mix_LoadMUS( "assets/MenuSoundHax.wav" );

    if (audioEnabled) {
        if(!hax)
            Mix_PlayMusic(music, 420);
        else
            Mix_PlayMusic(musicHax, 420);
    }

    int cordx, cordy;
    bool pressed=0;
    bool click = 0;

    while ( true )
    {
        event(0);
        
        // Render menu
        SDL_RenderClear(renderer);
        if(menuTexture)
            SDL_RenderCopy(renderer, menuTexture, NULL, NULL);
        SDL_RenderPresent(renderer);
        SDL_Delay(10); // Reduce CPU usage

        cordx = evnt.motion.x - 693;
        cordy = evnt.motion.y - 165;
        //std::cout<<"x: "<<cordx<<"  y: "<<cordy<<std::endl;
        //std::cout <<sqrt(cordx*cordx + cordy*cordy)<<std::endl;
        if(pressed==0 && evnt.type == SDL_MOUSEBUTTONDOWN && evnt.button.button == 2 && sqrt(cordx*cordx + cordy*cordy)<74)
            {
                if(hax==0)
                {
                    if (audioEnabled) Mix_PlayMusic(musicHax, 420);
                    std::cout <<"Hax: ON"<<std::endl;
                    hax=1;
                    pressed=1;
                }
                else
                {
                    if (audioEnabled) Mix_PlayMusic(music, 420);
                    std::cout <<"Hax: OFF"<<std::endl;
                    hax=0;
                    pressed=1;
                }
            }
            else
                if(pressed==1 && evnt.type == SDL_MOUSEBUTTONUP && evnt.button.button == 2)
                {
                    //std::cout <<"button up"<<std::endl;
                    pressed=0;
                    SDL_PollEvent(&evnt);
                }

        //X button
        if(click == 0 && evnt.motion.x > 745 && evnt.motion.x < 790 && evnt.motion.y > 5 && evnt.motion.y < 53 && evnt.type == SDL_MOUSEBUTTONDOWN )
        {
            killme();
        }
        else
        if(evnt.type == SDL_MOUSEBUTTONUP)
            click = 0;

        //trophy button
        if(click == 0 && evnt.motion.x > 678 && evnt.motion.x < 732 && evnt.motion.y > 5 && evnt.motion.y < 53 && evnt.type == SDL_MOUSEBUTTONDOWN)
        {
            scoreboardizp();
            click = 1;
        }
        else
        if(evnt.type == SDL_MOUSEBUTTONUP)
            click = 0;

        //clear board button
        if(click == 0 && evnt.motion.x > 175 && evnt.motion.x < 200 && evnt.motion.y > 35 && evnt.motion.y < 55 && evnt.type == SDL_MOUSEBUTTONDOWN)
        {
            clearboard();
            click = 1;
        }
        else
        if(evnt.type == SDL_MOUSEBUTTONUP)
            click = 0;

        //PLAY NOW button
        if(evnt.motion.x > 470 && evnt.motion.x < 765 && evnt.motion.y > 325 && evnt.motion.y < 412 && evnt.type == SDL_MOUSEBUTTONDOWN )
            {
               //break;
                Lv1();
            }


    }

    if(menuTexture)
        SDL_DestroyTexture(menuTexture);
    
    // imageSurface no longer used
    menuSurface = NULL;
}

void Game::event(bool showval)
{
    while(SDL_PollEvent(&evnt))
    {
        if (evnt.type == SDL_QUIT) 
        {
            killme();
        }

        if (showval)
        {
            switch (evnt.type)
            {
            case SDL_MOUSEMOTION:
                std::cout << "X: " <<evnt.motion.x << "  " << "Y: " << evnt.motion.y <<std::endl;
                break;

            case SDL_MOUSEBUTTONDOWN:
                switch (evnt.button.button)
                {
                case 1:
                    std::cout << "Left button pressed" << std::endl;
                    break;
                case 2:
                    std::cout << "Middle button pressed" << std::endl;
                    break;
                case 3:
                    std::cout << "Right button pressed" << std::endl;
                    break;
                }
                break;

            case SDL_MOUSEBUTTONUP:
                switch (evnt.button.button)
                {
                case 1:
                    std::cout << "Left button released" << std::endl;
                    break;
                case 2:
                    std::cout << "Middle button released" << std::endl;
                    break;
                case 3:
                    std::cout << "Right button released" << std::endl;
                    break;
                }
                break;
            }
        }
    }
}

void Game::Lv1()
{
    breaklv = 0;
    system("clear");
    std::cout << "      NAVODILE\nCilj igre je pokoncati cim vec piratov v dolocenem casu\nCe povozimo zival se nam odbije stevilo tock\nCe se zaletimo v oviro je levela v trenutku konec\nKlikni na ladjo da pricnes igro\nDesni klik za pavzo\nSredni klik za vrnitev na meni\n\n";
    score = 0;
    animalskilled = 0;

    int gametime = lvtime * 1000;
    int gametimer = 0;
    int lasttime = 0;
    int curtime;

    Graphics graphics;

    SDL_Texture* Background = graphics.loadTexture("assets/Blue.png", renderer);
    SDL_Texture* obst =  graphics.loadTexture("assets/Iceberg.png", renderer);
    SDL_Texture* enemytx =  graphics.loadTexture("assets/enemyboat.png", renderer);
    SDL_Texture* frietx =  graphics.loadTexture("assets/pingo.png", renderer);


    SDL_Texture* Player = graphics.loadTexture("assets/playerboat.png", renderer);
    SDL_Rect playerrect; playerrect.w = 50; playerrect.h = 50; playerrect.x = 700; playerrect.y = 50;


    obsticale a, b, c, d, e, f;
    enemy e1, e2, e3;
    friendly f1;


    bool tracking = 0;


    while( true )
    {
        event(0);

        //boat mouse tracking
        int mx, my;
        Uint32 buttons = SDL_GetMouseState(&mx, &my);
        
        if(tracking == 1)
        {
            playerrect.x = mx - 25;
            playerrect.y = my - 25;

            if(buttons & SDL_BUTTON(SDL_BUTTON_RIGHT))
                tracking = 0;
            if(buttons & SDL_BUTTON(SDL_BUTTON_MIDDLE))
            {
                menu();
                std::cout << "Level break" << std::endl;
                SDL_Delay(50);
                break;
            }
        }
        else
            {
                if (mx > playerrect.x && mx < playerrect.x + 50 && my > playerrect.y && my < playerrect.y + 50 && (buttons & SDL_BUTTON(SDL_BUTTON_LEFT)))
                    {
                        tracking = 1;
                    }
            }
            if(tracking == 1)
            {
                if(lasttime == 0)
                    lasttime = SDL_GetTicks();
                else
                {
                    curtime = SDL_GetTicks();
                    gametimer = gametimer + curtime - lasttime;
                    lasttime = curtime;
                }
                system("clear");
                std::cout<< "Seconds remaining: " << (float)(gametime - gametimer) / 1000 <<"\n";

            }
            else
            {
                lasttime = 0;
                curtime = 0;
            }


        //timer
        if(gametimer >= gametime)
            break; // brejka iz lv1 whijla

        //*
        if(tracking)
        if(!hax)
        if(a.colplayer(playerrect) || b.colplayer(playerrect) || c.colplayer(playerrect) || d.colplayer(playerrect)|| e.colplayer(playerrect)|| f.colplayer(playerrect)) // ce zadanemo v goro se igra ustavi
            {
                std::cout<< "Zabiu si se autist " << std::endl;
                break;
            }//*/

        if(tracking) {
        if(e1.colplayer(playerrect) || e2.colplayer(playerrect) ||e3.colplayer(playerrect))
        {
            score += 100;// score mby
            e1.respawncord();
            e2.respawncord();
            e3.respawncord();
        }
        }

        if(tracking) {
        if(!hax)
        {
            if(f1.colplayer(playerrect))
            {
                score -= 100;// score mby
                animalskilled++;
                f1.respawncord();
            }
        }
        else
        {
            f1.movement();
        }
        }

        // render all my shit
        SDL_RenderCopy(renderer, Background, NULL, NULL);
        //ovire
        a.render(renderer, obst);
        b.render(renderer, obst);
        c.render(renderer, obst);
        d.render(renderer, obst);
        e.render(renderer, obst);
        f.render(renderer, obst);
        //enemy
        e1.render(renderer, enemytx, hax);
        e2.render(renderer, enemytx, hax);
        e3.render(renderer, enemytx, hax);

        f1.render(renderer, frietx, hax);


        SDL_RenderCopy(renderer, Player, NULL, &playerrect);

        SDL_RenderPresent(renderer);

        // prblizn 60fps
        SDL_Delay(16);
    }
    SDL_DestroyTexture(obst);
    SDL_DestroyTexture(enemytx);
    std::cout << "Your score: " << score << std::endl << "Frderbou si: " << animalskilled << " Zivali" << std::endl;
    if(animalskilled >= 3)
        std::cout << "You monster" << std::endl;
    SDL_Delay(1000);
    Lv2();
}

void Game::Lv2()
{
    system("clear");

    int gametime = lvtime * 1000;
    int gametimer = 0;
    int lasttime = 0;
    int curtime;

    Graphics graphics;

    SDL_Texture* Background = graphics.loadTexture("assets/Green.png", renderer);
    SDL_Texture* obst =  graphics.loadTexture("assets/Lilipad.png", renderer);
    SDL_Texture* enemytx =  graphics.loadTexture("assets/enemyboat.png", renderer);
    SDL_Texture* frietx =  graphics.loadTexture("assets/zabika.png", renderer);


    SDL_Texture* Player = graphics.loadTexture("assets/playerboat.png", renderer);
    SDL_Rect playerrect; playerrect.w = 50; playerrect.h = 50; playerrect.x = 700; playerrect.y = 50;


    obsticale a, b, c, d, e, f, g;
    enemy e1, e2;
    friendly f1, f2, f3;


    bool tracking = 0;


    while( true )
    {
        event(0);

        //boat mouse tracking
        if(tracking == 1)
        {
            playerrect.x = evnt.motion.x - 25;
            playerrect.y = evnt.motion.y - 25;

            if(evnt.type == SDL_MOUSEBUTTONDOWN && evnt.button.button == 3)
                tracking = 0;
            if(evnt.type == SDL_MOUSEBUTTONDOWN && evnt.button.button == 2)
            {
                menu();
                std::cout << "Level break" << std::endl;
                SDL_Delay(50);
                break;
            }
        }
        else
            {
                if (evnt.motion.x > playerrect.x && evnt.motion.x < playerrect.x + 50 && evnt.motion.y > playerrect.y && evnt.motion.y < playerrect.y + 50 && evnt.type == SDL_MOUSEBUTTONDOWN && evnt.button.button == 1)
                    {
                        tracking = 1;
                    }
            }
            if(tracking == 1)
            {
                if(lasttime == 0)
                    lasttime = SDL_GetTicks();
                else
                {
                    curtime = SDL_GetTicks();
                    gametimer = gametimer + curtime - lasttime;
                    lasttime = curtime;
                }
                system("clear");
                std::cout<< "Seconds remaining: " << (float)(gametime - gametimer) / 1000 <<"\n";

            }
            else
            {
                lasttime = 0;
                curtime = 0;
            }


        //timer
        if(gametimer >= gametime)
            break; // brejka iz lv1 whijla

        //*
        if(tracking)
        if(!hax)
        if(a.colplayer(playerrect) || b.colplayer(playerrect) || c.colplayer(playerrect) || d.colplayer(playerrect)|| e.colplayer(playerrect)|| f.colplayer(playerrect) || g.colplayer(playerrect)) // ce zadanemo v goro se igra ustavi
            {
                std::cout<< "Zabiu si se autist " << std::endl;
                break;
            }//*/

        if(tracking) {
        if(e1.colplayer(playerrect) || e2.colplayer(playerrect))
        {
            score += 200;// score mby
            e1.respawncord();
            e2.respawncord();
        }
        }

        if(tracking) {
        if(!hax)
        {
           if(f1.colplayer(playerrect) || f2.colplayer(playerrect) || f3.colplayer(playerrect))
        {
            score -= 100;// score mby
            animalskilled++;
            f1.respawncord();
            f2.respawncord();
            f3.respawncord();
        }
        }
        else
        {
            f1.movement();
            f2.movement();
            f3.movement();
        }
        }


        // render all my shit
        SDL_RenderCopy(renderer, Background, NULL, NULL);
        //ovire
        a.render(renderer, obst);
        b.render(renderer, obst);
        c.render(renderer, obst);
        d.render(renderer, obst);
        e.render(renderer, obst);
        f.render(renderer, obst);
        g.render(renderer, obst);
        //enemy
        e1.render(renderer, enemytx, hax);
        e2.render(renderer, enemytx, hax);


        f1.render(renderer, frietx, hax);
        f2.render(renderer, frietx, hax);
        f3.render(renderer, frietx, hax);


        SDL_RenderCopy(renderer, Player, NULL, &playerrect);

        SDL_RenderPresent(renderer);

        // prblizn 60fps
        SDL_Delay(16);
    }
    SDL_DestroyTexture(obst);
    SDL_DestroyTexture(enemytx);
    std::cout << "Your score: " << score << std::endl << "Frderbou si: " << animalskilled << " Zivali" << std::endl;
    if(animalskilled >= 3)
        std::cout << "You monster" << std::endl;
    SDL_Delay(1000);
    Lv3();
}

void Game::Lv3()
{
    system("clear");

    int gametime = lvtime * 1000;
    int gametimer = 0;
    int lasttime = 0;
    int curtime;

    Graphics graphics;

    SDL_Texture* Background = graphics.loadTexture("assets/Orange.png", renderer);
    SDL_Texture* obst =  graphics.loadTexture("assets/crystal.png", renderer);
    SDL_Texture* enemytx =  graphics.loadTexture("assets/enemyboat.png", renderer);
    SDL_Texture* frietx =  graphics.loadTexture("assets/ribica.png", renderer);

    SDL_Texture* doggo = graphics.loadTexture("assets/seadoggo.png", renderer);
    SDL_Rect doggorect; doggorect.w = 800; doggorect.h = 600; doggorect.x = 0; doggorect.y = 0;

    SDL_Texture* Player = graphics.loadTexture("assets/playerboat.png", renderer);
    SDL_Rect playerrect; playerrect.w = 50; playerrect.h = 50; playerrect.x = 700; playerrect.y = 50;


    obsticale a, b, c, d, e, f, g, h, i;
    enemy e1;
    friendly f1, f2, f3, f4, f5;


    bool tracking = 0;


    while( true )
    {
        event(0);

        //boat mouse tracking
        int mx, my;
        Uint32 buttons = SDL_GetMouseState(&mx, &my);

        if(tracking == 1)
        {
            playerrect.x = mx - 25;
            playerrect.y = my - 25;

            if(buttons & SDL_BUTTON(SDL_BUTTON_RIGHT))
                tracking = 0;
            if(buttons & SDL_BUTTON(SDL_BUTTON_MIDDLE))
            {
                menu();
                std::cout << "Level break" << std::endl;
                SDL_Delay(50);
                break;
            }
        }
        else
            {
                if (mx > playerrect.x && mx < playerrect.x + 50 && my > playerrect.y && my < playerrect.y + 50 && (buttons & SDL_BUTTON(SDL_BUTTON_LEFT)))
                    {
                        tracking = 1;
                    }
            }
            if(tracking == 1)
            {
                if(lasttime == 0)
                    lasttime = SDL_GetTicks();
                else
                {
                    curtime = SDL_GetTicks();
                    gametimer = gametimer + curtime - lasttime;
                    lasttime = curtime;
                }
                system("clear");
                std::cout<< "Seconds remaining: " << (float)(gametime - gametimer) / 1000 <<"\n";

            }
            else
            {
                lasttime = 0;
                curtime = 0;
            }


        //timer
        if(gametimer >= gametime)
            break; // brejka iz lv1 whijla

        //*
        if(tracking)
        if(!hax)
        if(a.colplayer(playerrect) || b.colplayer(playerrect) || c.colplayer(playerrect) || d.colplayer(playerrect) || e.colplayer(playerrect) || f.colplayer(playerrect) || g.colplayer(playerrect) || h.colplayer(playerrect) || i.colplayer(playerrect)) // ce zadanemo v goro se igra ustavi
            {
                std::cout<< "Zabiu si se autist " << std::endl;
                break;
            }//*/

        if(tracking) {
        if(e1.colplayer(playerrect))
        {
            score += 300;// score mby
            e1.respawncord();
        }
        }

        if(tracking) {
        if(!hax)
        {
            if(f1.colplayer(playerrect) || f2.colplayer(playerrect) || f3.colplayer(playerrect) || f4.colplayer(playerrect) || f5.colplayer(playerrect))
        {
            score -= 100;// score mby
            animalskilled++;
            f1.respawncord();
            f2.respawncord();
            f3.respawncord();
            f4.respawncord();
            f5.respawncord();
        }
        }
        else
        {
            f1.movement();
            f2.movement();
            f3.movement();
            f4.movement();
            f5.movement();
        }
        }

        // render all my shit
        SDL_RenderCopy(renderer, Background, NULL, NULL);
        //ovire
        a.render(renderer, obst);
        b.render(renderer, obst);
        c.render(renderer, obst);
        d.render(renderer, obst);
        e.render(renderer, obst);
        f.render(renderer, obst);
        g.render(renderer, obst);
        h.render(renderer, obst);
        i.render(renderer, obst);

        //enemy
        e1.render(renderer, enemytx, hax);

        f1.render(renderer, frietx, hax);
        f2.render(renderer, frietx, hax);
        f3.render(renderer, frietx, hax);
        f4.render(renderer, frietx, hax);
        f5.render(renderer, frietx, hax);


        SDL_RenderCopy(renderer, Player, NULL, &playerrect);

        SDL_RenderPresent(renderer);

        // prblizn 60fps
        SDL_Delay(16);
    }
    SDL_DestroyTexture(obst);
    SDL_DestroyTexture(enemytx);
    std::cout << "Your score: " << score << std::endl << "Frderbou si: " << animalskilled << " Zivali" << std::endl;
    if(animalskilled >= 3)
        std::cout << "You monster" << std::endl;

    SDL_RenderCopy(renderer, doggo, NULL, &doggorect);
    SDL_RenderPresent(renderer);
    SDL_Delay(1000);
    scoreboard();
    menu();
}

void Game::scoreboard()
{
    /*
    }
    */
    std::ifstream data("score.txt");
    std::ofstream data1("tmp.txt");
    if(data.is_open() && data1.is_open())
    {
        system("clear");
        std::string ime, str;
        int val;
        bool done = 0;
        std::cout << "Vpisi svoje ime: ";
        std::getline(std::cin, ime);
        while(data >> str >> val)
        {
            if(done == 0 && score > val)
            {
                data1 << ime << " " << score << std::endl;
                data1 << str << " " << val << std::endl;
                done = 1;
            }
            else
            {
                data1 << str << " " << val << std::endl;
            }
        }
        if(done == 0)
        {
            data1 << ime << " " << score << std::endl;
        }

        data.close();
        data1.close();
        remove("score.txt");
        rename("tmp.txt", "score.txt");
    }
    else
    {
        std::ofstream data3("score.txt", std::ios::app);
        if(data3.is_open())
        {
            std::string str;
            system("clear");
            std::cout << "Vpisi svoje ime: ";
            std::getline(std::cin, str);
            data3 << str << " " << score << std::endl;
            data3.close();
        }
    }
}

void Game::scoreboardizp()
{
    system("clear");
    int counter = 1, val;
    std::string str;
    std::ifstream data("score.txt");
    std::cout << "          SCOREBOARD\n";
    if(data.is_open())
    {
        while(data >> str >> val && counter < 11)
        {
            std::cout << std::right << std::setw(3) << counter << ". " << std::setw(20) << std::left <<  str << " " << val << std::endl;
            counter++;
        }
        data.close();
    }
    else
    {
        std::cout << "\nNo scores\n";
    }
}

